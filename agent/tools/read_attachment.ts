import { defineTool } from "eve/tools";
import { z } from "zod";
import {
  getAgentAttachmentPage,
  getChatIdByEveSessionId,
} from "@/lib/db/queries";

// Paged reader for PDFs the user attached through the composer. The upload
// route extracts each page's Markdown with @firecrawl/pdf-inspector and
// stores it per page; this tool serves one page (or the page index) on
// demand, so a 59-page document costs a few KB per turn instead of one
// giant inline payload.
//
// Ownership: the attachment's uploader must match the user of the chat that
// owns the current eve session.
export default defineTool({
  description:
    "Read pages of a PDF you (or the user) attached earlier in this conversation. Pass page to read one page; omit it to list the available pages.",
  inputSchema: z.object({
    attachmentId: z
      .string()
      .describe("The attachment id from the attached-PDF notice."),
    page: z
      .number()
      .int()
      .positive()
      .nullish()
      .describe("1-indexed page to read. Omit to list available pages."),
  }),
  async execute(input, ctx) {
    const chatId = await getChatIdByEveSessionId(ctx.session.id);

    if (!chatId) {
      return {
        status: "error",
        error:
          "No chat is linked to this session, so stored attachments cannot be resolved.",
      };
    }

    const page = await getAgentAttachmentPage(
      input.attachmentId,
      ctx.session.id,
      input.page ?? 0,
    );

    if (!page) {
      return {
        status: "error",
        error: `Attachment ${input.attachmentId} was not found for this conversation (or page ${input.page ?? "?"} does not exist).`,
      };
    }

    if (input.page === undefined || input.page === 0) {
      return {
        status: "ok",
        name: page.name,
        pageCount: page.pageCount,
        hint: `Read a page with page: 1..${page.pageCount}.`,
      };
    }

    return {
      status: "ok",
      name: page.name,
      page: input.page,
      pageCount: page.pageCount,
      markdown: page.markdown,
    };
  },
});
