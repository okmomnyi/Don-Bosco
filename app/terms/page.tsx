import { HorizonLine } from "@/components/Horizon";

export const metadata = {
  title: "Terms of Use — St. Mary's Senior Youth",
  description:
    "The terms for using the St. Mary's Senior Youth member portal and website.",
};

const sections = [
  {
    heading: "Who this is for",
    body: "This portal is for registered members and leaders of St. Mary's Senior Youth, Don Bosco, Changamwe Parish. Accounts are created by group leaders for current members.",
  },
  {
    heading: "Your account",
    body: "Keep your password private and do not share your sign-in details. You are responsible for activity on your account. If you were given a temporary password, you will be asked to set your own on first sign-in.",
  },
  {
    heading: "Acceptable use",
    body: "Use the portal only to view your own records and to take part in the life of the group. Do not attempt to access other members' information, disrupt the service, or misuse any administrative access you may be granted.",
  },
  {
    heading: "Accuracy of records",
    body: "Contribution records are entered by group leaders and are kept in good faith. If something looks wrong, raise it with a leader so it can be checked and corrected.",
  },
  {
    heading: "Changes",
    body: "The group may update these terms or the portal's features from time to time. Continued use after a change means you accept the updated terms.",
  },
  {
    heading: "Contact",
    body: "Questions about these terms can be directed to your group leader at Don Bosco, Changamwe Parish.",
  },
];

export default function TermsPage() {
  return (
    <main className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-sage">
          Legal
        </p>
        <h1 className="mt-4 font-display text-4xl text-ink md:text-5xl">
          Terms of Use
        </h1>
        <HorizonLine className="mt-8 max-w-xs" />

        <div className="mt-12 space-y-10">
          {sections.map((s) => (
            <section key={s.heading}>
              <h2 className="font-display text-2xl text-ink">{s.heading}</h2>
              <p className="mt-3 font-body text-sm leading-relaxed text-ink/75">
                {s.body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
