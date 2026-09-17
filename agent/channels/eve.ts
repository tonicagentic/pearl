import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";
import { betterAuthEveAuth, passwordEveAuth } from "@/lib/eve-auth";

export default eveChannel({
  auth: [betterAuthEveAuth, passwordEveAuth, vercelOidc(), localDev()],
  // Screenshots, images, PDFs, and text files for the thinking-partner flows.
  uploadPolicy: {
    allowedMediaTypes: ["image/*", "text/*", "application/pdf"],
    maxBytes: 10 * 1024 * 1024,
  },
});
