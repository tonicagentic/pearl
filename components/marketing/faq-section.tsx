import Link from "next/link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarketingSection } from "@/components/marketing/section";
import { marketingType } from "@/components/marketing/type";

const FAQS = [
  {
    question: "Can I self-host Pearl?",
    answer:
      "Yes. Pearl is open source under Apache-2.0. Clone the repo, configure your environment, and run it on your own machine or deployment.",
  },
  {
    question: "What happens when I connect Gmail?",
    answer:
      "Pearl only uses the Gmail scopes needed to read mail, create drafts, send messages you approve, and apply labels or archive. Mail is not sold or used for advertising. You can disconnect Gmail or delete your account from Settings.",
  },
  {
    question: "Which models does Pearl use?",
    answer:
      "Pearl routes work through the Vercel AI Gateway. You can choose models such as Auto, Sol, and Astra depending on the task. Image generation uses Grok Imagine where available.",
  },
  {
    question: "What does Get started do?",
    answer:
      "Get started opens sign-in. After you sign in, the same URL loads the Pearl app so you can start a conversation, connect accounts, and create agents.",
  },
] as const;

export function FaqSection() {
  return (
    <MarketingSection id="faq">
      <div className="mx-auto max-w-2xl">
        <h2 className={`text-center ${marketingType.sectionTitle}`}>FAQ</h2>
        <Accordion
          className="mt-10 rounded-xl border border-border bg-card px-4 sm:px-5"
          collapsible
          defaultValue={FAQS[0].question}
          type="single"
        >
          {FAQS.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger className="text-left text-base font-medium tracking-tight hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className={marketingType.body}>
                {item.question === "What happens when I connect Gmail?" ? (
                  <>
                    {item.answer}{" "}
                    <Link
                      className="underline underline-offset-4 hover:text-foreground"
                      href="/privacy"
                    >
                      Privacy policy
                    </Link>
                  </>
                ) : (
                  item.answer
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </MarketingSection>
  );
}
