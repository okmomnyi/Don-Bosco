import { HorizonLine, SunMark } from "@/components/Horizon";

const requirements = [
  "Pay a registration fee of Ksh 100, renewed annually on 30th January.",
  "Complete a 9-day Novena as part of being commissioned into full membership.",
  "Wear the Archdiocese St. Don Bosco uniform, ordered through the Archdiocese office at a cost.",
  "Receive the St. Don Bosco Medal, provided by the Archdiocese office at a cost.",
  "Hold a copy of the CSY Constitution, provided by the Archdiocese office at a cost.",
  "Hold the CSY Manual guidebook, given by the diocese at a cost.",
];

const rights = [
  "Participate fully in the affairs of the group.",
  "Pursue personal development, provided it does not conflict with the teachings of the church.",
  "Be treated with respect and value, as every person deserves.",
];

const principles = [
  "Practice Christian values and the Sacramental life according to the teachings of the Catholic church.",
  "Be role models of sanctity like St. Don Bosco, the father and guide of the group.",
  "Ensure full participation of all members in both the social and spiritual life of the group.",
  "Manage group resources efficiently for the welfare of the members.",
  "Pursue sustainable management, recognising the group's responsibility to future generations.",
  "Cooperate and stand in solidarity with other Catholic Senior Youth groups.",
  "Offer advice and assistance to one another wherever it's needed.",
  "Initiate pastoral, income-generating activities that benefit the group.",
  "Stay open to the needs of others, especially the young and the needy.",
  "Strive always to resolve conflicts with goodness and kindness.",
];

const termination = [
  "When a member's age exceeds 25 years.",
  "When a member has a child.",
  "When a member gets married.",
  "When a member is expelled by the Parish Priest due to gross misconduct.",
  "When a member enters a 'come we stay' relationship.",
];

export default function ValuesMembershipPage() {
  return (
    <main className="px-6 py-16 md:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-sage">
          Belonging
        </p>
        <h1 className="mt-4 font-display text-4xl text-ink md:text-5xl">
          Values & Membership
        </h1>
        <HorizonLine className="mt-8 max-w-xs" />

        {/* Membership requirements + rights */}
        <div className="mt-16 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl text-ink">Membership</h2>
            <ul className="mt-6 space-y-4">
              {requirements.map((item) => (
                <li key={item} className="flex gap-3">
                  <SunMark className="mt-2 shrink-0" />
                  <span className="font-body text-sm leading-relaxed text-ink/75">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-2xl text-ink">
              Rights of a Member
            </h2>
            <ul className="mt-6 space-y-4">
              {rights.map((item) => (
                <li key={item} className="flex gap-3">
                  <SunMark className="mt-2 shrink-0" />
                  <span className="font-body text-sm leading-relaxed text-ink/75">
                    {item}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-10 rounded-3xl border border-coral/30 bg-coral/5 p-6">
              <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-coral">
                Membership ends
              </h3>
              <ul className="mt-4 space-y-2">
                {termination.map((item) => (
                  <li
                    key={item}
                    className="font-body text-sm leading-relaxed text-ink/70"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Values, principles and goals */}
        <div className="mt-20">
          <h2 className="font-display text-2xl text-ink">
            Values, Principles & Goals
          </h2>
          <p className="mt-3 max-w-2xl font-body text-sm text-ink/60">
            What guides every member of the group, in everyday life and in
            service to the parish.
          </p>
          <div className="mt-8 grid gap-x-12 gap-y-4 sm:grid-cols-2">
            {principles.map((item) => (
              <div key={item} className="flex gap-3 border-t border-ink/10 py-4">
                <SunMark className="mt-1.5 shrink-0" />
                <span className="font-body text-sm leading-relaxed text-ink/75">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
