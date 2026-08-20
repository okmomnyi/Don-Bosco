import { HorizonLine } from "@/components/Horizon";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How St. Mary's Senior Youth collects, uses and protects member information.",
  alternates: { canonical: "/privacy" },
};

const sections = [
  {
    heading: "What we collect",
    body: "When you are registered as a member, we store your name, phone number, and a securely hashed version of your password. As you participate, we record your contributions — the amount, type, date and any notes added by a group leader.",
  },
  {
    heading: "How we use it",
    body: "Your information is used only to run the group: to sign you in, to show you your own contribution history, and to let group leaders keep accurate records and report on the group's overall funds. We do not sell or share your data with third parties.",
  },
  {
    heading: "Who can see your records",
    body: "You can see only your own contribution history. Group administrators can see members' records in order to manage the group. The old practice of looking anyone's record up by phone number has been retired.",
  },
  {
    heading: "How we protect it",
    body: "Passwords are never stored in plain text — they are hashed with bcrypt. Sessions are kept in a secure, http-only cookie. Access to administrative tools is restricted to authorised group leaders.",
  },
  {
    heading: "Your choices",
    body: "You may ask a group leader to correct your details, or to deactivate your account if you leave the group. Deactivating keeps past records for the group's accounts but removes your ability to sign in.",
  },
  {
    heading: "Contact",
    body: "For any question about your information, speak to your group leader at Don Bosco, Changamwe Parish.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-sage">
          Legal
        </p>
        <h1 className="mt-4 font-display text-4xl text-ink md:text-5xl">
          Privacy Policy
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
