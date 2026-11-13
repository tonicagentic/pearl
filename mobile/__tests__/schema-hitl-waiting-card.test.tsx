import {
  fireEvent,
  render,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

import { WaitingActionCard } from "@/components/assistant-ui/elements/waiting-action-card";

describe("Schema Designer mobile HITL card", () => {
  test("choice question selects then Done submits option id", async () => {
    const onRespond = jest.fn().mockResolvedValue(undefined);

    const { getByTestId, queryByLabelText } = await render(
      <WaitingActionCard
        action={{
          kind: "questions",
          items: [
            {
              id: "q1",
              prompt: "Does a handshake count as a commitment?",
              options: [
                { id: "yes", label: "Yes, it counts" },
                { id: "no", label: "No, spoken only" },
              ],
              allowFreeform: false,
            },
          ],
          onRespond,
        }}
      />,
    );

    expect(getByTestId("waiting-action-prompt")).toHaveTextContent(
      "Does a handshake count as a commitment?",
    );
    expect(getByTestId("waiting-action-option-yes")).toBeTruthy();
    expect(getByTestId("waiting-action-option-no")).toBeTruthy();
    expect(queryByLabelText("Allow")).toBeNull();
    expect(queryByLabelText("Deny")).toBeNull();
    expect(queryByLabelText("Skip")).toBeNull();

    fireEvent.press(getByTestId("waiting-action-option-yes"));
    expect(onRespond).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(getByTestId("waiting-action-send")).toBeEnabled();
    });
    fireEvent.press(getByTestId("waiting-action-send"));
    await waitFor(() => {
      expect(onRespond).toHaveBeenCalledWith({
        interactionId: "q1",
        optionId: "yes",
      });
    });
  });

  test("open question submits typed exclusion text", async () => {
    const onRespond = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    const { getByTestId } = await render(
      <WaitingActionCard
        action={{
          kind: "questions",
          items: [
            {
              id: "q-text",
              prompt: "What should this concept exclude?",
              options: [],
              allowFreeform: true,
            },
          ],
          onRespond,
        }}
      />,
    );

    await user.type(
      getByTestId("waiting-action-answer"),
      "Vague hopes with no promise",
    );
    await user.press(getByTestId("waiting-action-send"));

    await waitFor(() => {
      expect(onRespond).toHaveBeenCalledWith({
        interactionId: "q-text",
        text: "Vague hopes with no promise",
      });
    });
  });

  test("Something else covers options and submits freeform text", async () => {
    const onRespond = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    const { getByTestId, queryByTestId } = await render(
      <WaitingActionCard
        action={{
          kind: "questions",
          items: [
            {
              id: "q-choose",
              prompt: "Which surface should we ship first?",
              options: [
                { id: "mobile", label: "Mobile" },
                { id: "web", label: "Web" },
                { id: "both", label: "Both" },
              ],
              allowFreeform: true,
            },
          ],
          onRespond,
        }}
      />,
    );

    expect(queryByTestId("waiting-action-answer")).toBeNull();
    expect(getByTestId("waiting-action-option-mobile")).toBeTruthy();

    fireEvent.press(getByTestId("waiting-action-option-freeform"));
    await waitFor(() => {
      expect(getByTestId("waiting-action-answer")).toBeTruthy();
    });
    expect(queryByTestId("waiting-action-option-mobile")).toBeNull();

    await user.type(getByTestId("waiting-action-answer"), "Desktop only");
    await waitFor(() => {
      expect(getByTestId("waiting-action-send")).toBeEnabled();
    });
    fireEvent.press(getByTestId("waiting-action-send"));
    await waitFor(() => {
      expect(onRespond).toHaveBeenCalledWith({
        interactionId: "q-choose",
        text: "Desktop only",
      });
    });
  });

  test("multi questions Skip advances and Next submits current page", async () => {
    const onRespond = jest.fn().mockResolvedValue(undefined);
    const onSkip = jest.fn().mockResolvedValue(undefined);

    const { getByTestId, queryByTestId } = await render(
      <WaitingActionCard
        action={{
          kind: "questions",
          items: [
            {
              id: "q-a",
              prompt: "First question?",
              options: [
                { id: "one", label: "One" },
                { id: "two", label: "Two" },
              ],
              allowFreeform: false,
            },
            {
              id: "q-b",
              prompt: "Second question?",
              options: [
                { id: "yes", label: "Yes" },
                { id: "no", label: "No" },
              ],
              allowFreeform: false,
            },
          ],
          onRespond,
          onSkip,
        }}
      />,
    );

    expect(getByTestId("questions-progress")).toHaveTextContent("1/2");
    expect(getByTestId("waiting-action-prompt")).toHaveTextContent(
      "First question?",
    );
    expect(queryByTestId("waiting-action-back")).toBeNull();

    fireEvent.press(getByTestId("waiting-action-skip"));
    await waitFor(() => {
      expect(getByTestId("waiting-action-prompt")).toHaveTextContent(
        "Second question?",
      );
    });
    expect(getByTestId("questions-progress")).toHaveTextContent("2/2");
    expect(onSkip).not.toHaveBeenCalled();
    expect(getByTestId("waiting-action-back")).toBeTruthy();

    fireEvent.press(getByTestId("waiting-action-option-yes"));
    await waitFor(() => {
      expect(getByTestId("waiting-action-send")).toBeEnabled();
    });
    fireEvent.press(getByTestId("waiting-action-send"));
    await waitFor(() => {
      expect(onRespond).toHaveBeenCalledWith({
        interactionId: "q-b",
        optionId: "yes",
      });
    });
    expect(queryByTestId("waiting-action-send")).toBeTruthy();
  });

  test("multi questions Back restores the prior selection", async () => {
    const onRespond = jest.fn().mockResolvedValue(undefined);

    const { getByTestId, queryByTestId } = await render(
      <WaitingActionCard
        action={{
          kind: "questions",
          items: [
            {
              id: "q-a",
              prompt: "First question?",
              options: [
                { id: "one", label: "One" },
                { id: "two", label: "Two" },
              ],
              allowFreeform: false,
            },
            {
              id: "q-b",
              prompt: "Second question?",
              options: [
                { id: "yes", label: "Yes" },
                { id: "no", label: "No" },
              ],
              allowFreeform: false,
            },
          ],
          onRespond,
        }}
      />,
    );

    fireEvent.press(getByTestId("waiting-action-option-one"));
    await waitFor(() => {
      expect(getByTestId("waiting-action-send")).toBeEnabled();
    });
    fireEvent.press(getByTestId("waiting-action-send"));
    await waitFor(() => {
      expect(getByTestId("waiting-action-prompt")).toHaveTextContent(
        "Second question?",
      );
    });

    fireEvent.press(getByTestId("waiting-action-back"));
    await waitFor(() => {
      expect(getByTestId("waiting-action-prompt")).toHaveTextContent(
        "First question?",
      );
    });
    expect(getByTestId("questions-progress")).toHaveTextContent("1/2");
    expect(queryByTestId("waiting-action-back")).toBeNull();
    expect(
      getByTestId("waiting-action-option-one").props.accessibilityState,
    ).toMatchObject({ selected: true });
  });

  test("propose_schema approval shows statement and submits approve/deny", async () => {
    const onRespond = jest.fn().mockResolvedValue(undefined);

    const prompt =
      "Save schema: Commitment (commitment)\nA promise the speaker intends to keep.\nIncludes: Explicit promise\nExcludes: Vague hope";

    const view = await render(
      <WaitingActionCard
        action={{
          kind: "approval",
          title: "The agent is paused until you respond.",
          prompt,
          detail: "A promise the speaker intends to keep.",
          options: [
            { id: "approve", label: "Allow" },
            { id: "deny", label: "Deny" },
          ],
          onRespond,
        }}
      />,
    );

    expect(view.getByTestId("waiting-action-card")).toBeTruthy();
    expect(view.getByTestId("waiting-action-prompt")).toHaveTextContent(
      /Includes: Explicit promise/,
    );
    expect(view.getByTestId("waiting-action-detail")).toHaveTextContent(
      "A promise the speaker intends to keep.",
    );

    fireEvent.press(view.getByTestId("waiting-action-option-approve"));
    await waitFor(() => {
      expect(onRespond).toHaveBeenCalledWith({ optionId: "approve" });
    });

    onRespond.mockClear();
    view.unmount();

    const denied = await render(
      <WaitingActionCard
        action={{
          kind: "approval",
          title: "The agent is paused until you respond.",
          prompt: "Save schema: Commitment (commitment)",
          options: [
            { id: "approve", label: "Allow" },
            { id: "deny", label: "Deny" },
          ],
          onRespond,
        }}
      />,
    );

    fireEvent.press(denied.getByTestId("waiting-action-option-deny"));
    await waitFor(() => {
      expect(onRespond).toHaveBeenCalledWith({ optionId: "deny" });
    });
  });
});
