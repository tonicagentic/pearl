import {
  fireEvent,
  render,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import React from "react";

import { WaitingActionCard } from "@/components/assistant-ui/elements/waiting-action-card";

describe("Schema Designer mobile HITL card", () => {
  test("choice question shows prompt and option ids, without Allow/Deny", async () => {
    const onRespond = jest.fn().mockResolvedValue(undefined);

    const { getByTestId, queryByLabelText } = await render(
      <WaitingActionCard
        action={{
          kind: "question",
          title: "The agent is paused until you answer.",
          prompt: "Does a handshake count as a commitment?",
          options: [
            { id: "yes", label: "Yes, it counts" },
            { id: "no", label: "No, spoken only" },
          ],
          allowFreeform: false,
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
    expect(queryByLabelText("Approve")).toBeNull();
    expect(queryByLabelText("Cancel")).toBeNull();

    fireEvent.press(getByTestId("waiting-action-option-yes"));
    await waitFor(() => {
      expect(onRespond).toHaveBeenCalledWith({ optionId: "yes" });
    });
  });

  test("open question submits typed exclusion text", async () => {
    const onRespond = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    const { getByTestId } = await render(
      <WaitingActionCard
        action={{
          kind: "question",
          title: "The agent is paused until you answer.",
          prompt: "What should this concept exclude?",
          options: [],
          allowFreeform: true,
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
        text: "Vague hopes with no promise",
      });
    });
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
