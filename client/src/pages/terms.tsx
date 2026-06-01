import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen glass-bg p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Link href="/settings">
          <Button variant="ghost" className="mb-6" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </Link>

        <Card className="card-depth">
          <CardHeader>
            <CardTitle className="text-3xl">Terms of Service</CardTitle>
            <p className="text-sm text-muted-foreground">Last updated: October 25, 2025</p>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using Jango.us, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">2. User Accounts</h2>
              <p className="text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must immediately notify us of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">3. Skill-Based Gaming</h2>
              <p className="text-muted-foreground">
                Jango.us is a skill-based gaming platform. All games are designed to reward player skill rather than chance. By participating, you acknowledge that outcomes are determined by your gameplay decisions and abilities.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">4. Wagering and Platform Rake</h2>
              <p className="text-muted-foreground">
                All wagered matches are subject to a 3% platform rake deducted from the pot. This fee supports platform maintenance, development, and operational costs. By creating or joining a match with a wager, you agree to this fee structure.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">5. Responsible Gaming</h2>
              <p className="text-muted-foreground">
                We are committed to promoting responsible gaming. You may set spending limits, wager caps, cool-off periods, or self-exclusion periods at any time through your account settings. Self-exclusion cannot be reversed until the specified period expires.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">6. Prohibited Conduct</h2>
              <p className="text-muted-foreground mb-2">You agree not to:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4">
                <li>Use cheating software, bots, or automated systems</li>
                <li>Collude with other players to manipulate match outcomes</li>
                <li>Harass, abuse, or threaten other users</li>
                <li>Create multiple accounts to circumvent restrictions</li>
                <li>Engage in any fraudulent activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">7. Account Suspension and Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to suspend or terminate accounts that violate these terms, engage in prohibited conduct, or pose a risk to the platform integrity. Terminated accounts may forfeit wallet balances if terminated for fraud or cheating.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">8. Wallet and Payments</h2>
              <p className="text-muted-foreground">
                All wallet transactions are final. Deposits are non-refundable except as required by law. Withdrawals may be subject to verification requirements. We reserve the right to investigate suspicious transactions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">9. Intellectual Property</h2>
              <p className="text-muted-foreground">
                All content, designs, graphics, and code on Jango.us are owned by or licensed to us. You may not copy, reproduce, distribute, or create derivative works without our express written permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">10. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                Jango.us is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the platform, including but not limited to lost profits, data loss, or service interruptions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">11. Dispute Resolution</h2>
              <p className="text-muted-foreground">
                Match disputes will be reviewed by our admin team using match logs and cryptographic verification. All decisions are final. For platform disputes, you agree to binding arbitration in accordance with applicable laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">12. Changes to Terms</h2>
              <p className="text-muted-foreground">
                We reserve the right to modify these terms at any time. Continued use of the platform after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or platform notification.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3">13. Contact Information</h2>
              <p className="text-muted-foreground">
                For questions about these Terms of Service, please contact us through the platform support system or at legal@jango.us.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
