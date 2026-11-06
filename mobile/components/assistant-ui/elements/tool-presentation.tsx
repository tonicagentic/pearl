import type { LucideIcon } from "lucide-react-native";
import {
  AppWindowIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  BanIcon,
  BellIcon,
  BookUserIcon,
  BrainIcon,
  CameraIcon,
  CircleCheckBigIcon,
  ClipboardCheckIcon,
  CloudSunIcon,
  Code2Icon,
  DownloadIcon,
  EraserIcon,
  FilePenIcon,
  FilePenLineIcon,
  FileTextIcon,
  FolderSearchIcon,
  GlobeIcon,
  InfoIcon,
  LayoutGridIcon,
  ListChecksIcon,
  ListPlusIcon,
  ListTodoIcon,
  PaperclipIcon,
  RocketIcon,
  SaveIcon,
  ScanSearchIcon,
  SearchIcon,
  SparklesIcon,
  SpellCheckIcon,
  TerminalIcon,
  TextSearchIcon,
  Trash2Icon,
  UploadIcon,
  WrenchIcon,
} from "lucide-react-native";

export type ToolPresentation = {
  /** Short human label for headers and chips. */
  readonly label: string;
  readonly icon: LucideIcon;
};

const TOOL_PRESENTATION: Record<string, ToolPresentation> = {
  confirm_step: { label: "Confirm step", icon: ClipboardCheckIcon },
  write_file: { label: "Write file", icon: FilePenIcon },
  edit_file: { label: "Edit file", icon: FilePenLineIcon },
  read_file: { label: "Read file", icon: FileTextIcon },
  bash: { label: "Run command", icon: TerminalIcon },
  web_search: { label: "Search the web", icon: SearchIcon },
  web_fetch: { label: "Fetch page", icon: GlobeIcon },
  get_weather: { label: "Check weather", icon: CloudSunIcon },
  get_profile: { label: "Profile", icon: BookUserIcon },
  list_skills: { label: "List skills", icon: SparklesIcon },
  get_skill: { label: "Get skill", icon: SparklesIcon },
  create_skill: { label: "Create skill", icon: SparklesIcon },
  update_skill: { label: "Update skill", icon: SparklesIcon },
  delete_skill: { label: "Delete skill", icon: SparklesIcon },
  send_notification: { label: "Send notification", icon: BellIcon },
  create_issue: { label: "Create issue", icon: ListPlusIcon },
  list_issues: { label: "List issues", icon: ListTodoIcon },
  resolve_issue: { label: "Resolve issue", icon: CircleCheckBigIcon },
  read_attachment: { label: "Read attachment", icon: PaperclipIcon },
  exa_agent_run: { label: "Research", icon: ScanSearchIcon },
  list_artifacts: { label: "List artifacts", icon: ArchiveIcon },
  restore_artifact: { label: "Restore artifact", icon: ArchiveRestoreIcon },
  list_assets: { label: "List assets", icon: LayoutGridIcon },
  upload_asset: { label: "Upload asset", icon: UploadIcon },
  download_asset: { label: "Download asset", icon: DownloadIcon },
  delete_asset: { label: "Delete asset", icon: Trash2Icon },
  get_asset_info: { label: "Asset info", icon: InfoIcon },
  create_app: { label: "Create app", icon: AppWindowIcon },
  list_apps: { label: "List apps", icon: AppWindowIcon },
  publish_app: { label: "Publish app", icon: RocketIcon },
  screenshot_app: { label: "Screenshot app", icon: CameraIcon },
  code_with_fx: { label: "Code with fx", icon: Code2Icon },
  get_writer_preferences: { label: "Writer preferences", icon: BookUserIcon },
  save_writer_preferences: { label: "Save preferences", icon: SaveIcon },
  clear_writer_preferences: { label: "Clear preferences", icon: EraserIcon },
  lint_against_style: { label: "Lint style", icon: SpellCheckIcon },
  glob: { label: "Find files", icon: FolderSearchIcon },
  grep: { label: "Search files", icon: TextSearchIcon },
  todo: { label: "Update plan", icon: ListChecksIcon },
  task_cancel: { label: "Cancel task", icon: BanIcon },
  load_skill: { label: "Load skill", icon: SparklesIcon },
  file__save_memory: { label: "Remember", icon: BrainIcon },
  file__remove_memory: { label: "Forget", icon: BrainIcon },
  get_surface_rubric: { label: "Get rubric", icon: ClipboardCheckIcon },
};

/** Turn `confirm_step` / `file__save_memory` into a readable fallback label. */
function humanizeToolName(toolName: string): string {
  const bare = toolName.includes("__")
    ? (toolName.split("__").pop() ?? toolName)
    : toolName;
  const spaced = bare.replace(/[_-]+/g, " ").trim();
  if (!spaced) return toolName;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Label + icon for a tool id; unknown tools get a humanized name and wrench. */
export function getToolPresentation(toolName: string): ToolPresentation {
  const known = TOOL_PRESENTATION[toolName];
  if (known) return known;
  return { label: humanizeToolName(toolName), icon: WrenchIcon };
}
