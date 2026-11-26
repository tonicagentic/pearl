import ExpoModulesCore
import ObjectiveC
import UIKit

private extension Notification.Name {
  static let pearlBookmarkSelection = Notification.Name("pearl.bookmarkSelection")
}

/// Installs a UITextView edit-menu hook so Bookmark sits beside Copy / Look Up.
enum TextSelectionMenuInstaller {
  static let shared = TextSelectionMenuInstallerBox()
}

final class TextSelectionMenuInstallerBox {
  private var onBookmark: ((String) -> Void)?
  private var observer: NSObjectProtocol?
  private var installed = false

  func attach(onBookmark: @escaping (String) -> Void) {
    self.onBookmark = onBookmark
    if observer == nil {
      observer = NotificationCenter.default.addObserver(
        forName: .pearlBookmarkSelection,
        object: nil,
        queue: .main
      ) { [weak self] note in
        guard let text = note.userInfo?["text"] as? String, !text.isEmpty else { return }
        self?.onBookmark?(text)
      }
    }
    installIfNeeded()
  }

  private func installIfNeeded() {
    guard !installed else { return }
    installed = true
    // Swizzle UITextView once — RN’s TextInput subclasses inherit this.
    pearlSwizzleEditMenu(on: UITextView.self)
  }
}

private func pearlSwizzleEditMenu(on cls: AnyClass) {
  let originalSelector = Selector(("editMenuForTextRange:suggestedActions:"))
  let swizzledSelector = #selector(UITextView.pearl_editMenu(for:suggestedActions:))

  guard
    let original = class_getInstanceMethod(cls, originalSelector),
    let swizzled = class_getInstanceMethod(cls, swizzledSelector)
  else {
    return
  }

  method_exchangeImplementations(original, swizzled)
}

extension UITextView {
  @objc func pearl_editMenu(
    for textRange: UITextRange,
    suggestedActions: [UIMenuElement]
  ) -> UIMenu? {
    // After exchange this calls the original implementation.
    let original = pearl_editMenu(for: textRange, suggestedActions: suggestedActions)

    let bookmark = UIAction(
      title: "Bookmark",
      image: UIImage(systemName: "bookmark")
    ) { [weak self] _ in
      guard
        let self,
        let range = self.selectedTextRange,
        let text = self.text(in: range)?.trimmingCharacters(in: .whitespacesAndNewlines),
        !text.isEmpty
      else {
        return
      }
      NotificationCenter.default.post(
        name: .pearlBookmarkSelection,
        object: nil,
        userInfo: ["text": text]
      )
    }

    var children = suggestedActions
    if let original {
      // Prefer system menu children when the original built a richer tree.
      children = original.children
    }
    // Avoid duplicate Bookmark entries if multiple hooks fire.
    let alreadyHasBookmark = children.contains { element in
      guard let action = element as? UIAction else { return false }
      return action.title == "Bookmark"
    }
    if !alreadyHasBookmark {
      children.append(bookmark)
    }
    return UIMenu(children: children)
  }
}

public class TextSelectionMenuModule: Module {
  public func definition() -> ModuleDefinition {
    Name("TextSelectionMenu")

    Events("onBookmark")

    OnCreate {
      TextSelectionMenuInstaller.shared.attach { [weak self] text in
        self?.sendEvent("onBookmark", ["text": text])
      }
    }
  }
}
