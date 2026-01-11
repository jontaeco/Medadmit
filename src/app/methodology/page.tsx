import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const metadata = {
  title: 'Methodology | MedAdmit',
  description: 'Detailed explanation of our medical school admission prediction model and scoring methodology.',
}

export default function MethodologyPage() {
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Our Methodology</h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          A comprehensive explanation of how MedAdmit predicts your medical school admission chances.
        </p>
      </div>

      {/* Overview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>What our prediction model does</CardDescription>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none space-y-4">
          <p>
            MedAdmit uses a multi-component scoring system combined with Monte Carlo simulation to predict
            your chances of admission to medical school. Our model produces:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Applicant Score (0-1000)</strong>: An overall competitiveness score</li>
            <li><strong>WARS Score (0-121)</strong>: A standardized applicant rating using the WedgeDawg system</li>
            <li><strong>Per-School Probabilities</strong>: Calibrated acceptance chances for each school</li>
            <li><strong>Expected Outcomes</strong>: Expected interviews and acceptances across your school list</li>
          </ul>
          <p className="text-sm text-slate-500 mt-4">
            Model Version: 1.0.0 | Data Version: 2024.1.0
          </p>
        </CardContent>
      </Card>

      {/* Applicant Score Section */}
      <Card>
        <CardHeader>
          <CardTitle>Applicant Score (0-1000)</CardTitle>
          <CardDescription>How we calculate your overall competitiveness</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Academic Score */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Academic Score (0-720 points)</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Academic credentials are the foundation of your application. We calculate separate contributions
              for GPA and MCAT, then combine them.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-4">
              <div>
                <h4 className="font-medium">GPA Contribution (0-360 points)</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Uses exponential scaling with breakpoints to reward higher GPAs more heavily.
                  If science GPA is provided, we use a weighted combination (60% science, 40% cumulative).
                </p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>2.0-2.5 GPA: 0-12 points (linear)</li>
                  <li>2.5-3.0 GPA: 12-36 points</li>
                  <li>3.0-3.5 GPA: 36-96 points</li>
                  <li>3.5-3.7 GPA: 96-144 points</li>
                  <li>3.7-3.8 GPA: 144-192 points</li>
                  <li>3.8-3.9 GPA: 192-264 points</li>
                  <li>3.9-4.0 GPA: 264-360 points</li>
                </ul>
              </div>

              <div>
                <h4 className="font-medium">MCAT Contribution (0-360 points)</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Uses sigmoid-like scaling centered around 510, providing faster growth in the
                  middle range where scores differentiate applicants most.
                </p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>472-495: Slow growth (~49 points at 495)</li>
                  <li>495-505: Moderate growth (~97 points at 505)</li>
                  <li>505-515: Faster growth (~193 points at 515)</li>
                  <li>515-520: Premium growth (~283 points at 520)</li>
                  <li>520-528: Plateau growth (283-360 points)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Experience Score */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Experience Score (0-330 points)</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Experiences demonstrate your commitment to medicine and ability to contribute to the
              medical school community.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-slate-700">
                    <th className="text-left py-2">Category</th>
                    <th className="text-right py-2">Max Points</th>
                    <th className="text-left py-2 pl-4">Thresholds</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">Clinical Experience</td>
                    <td className="text-right">90</td>
                    <td className="pl-4 text-slate-600 dark:text-slate-400">100, 300, 500, 1000+ hours</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">Research</td>
                    <td className="text-right">90</td>
                    <td className="pl-4 text-slate-600 dark:text-slate-400">200, 500, 1000+ hours + publication bonus</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">Volunteering</td>
                    <td className="text-right">60</td>
                    <td className="pl-4 text-slate-600 dark:text-slate-400">50, 150, 300+ hours</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">Leadership</td>
                    <td className="text-right">35</td>
                    <td className="pl-4 text-slate-600 dark:text-slate-400">Diminishing returns for 1, 2, 3, 4+ roles</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">Shadowing</td>
                    <td className="text-right">25</td>
                    <td className="pl-4 text-slate-600 dark:text-slate-400">20, 50+ hours</td>
                  </tr>
                  <tr>
                    <td className="py-2">Teaching/Tutoring</td>
                    <td className="text-right">30</td>
                    <td className="pl-4 text-slate-600 dark:text-slate-400">25, 50, 100, 200+ hours</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-slate-500 mt-3">
                Publication bonus: +6 base + 2.4 per publication (up to +12 total)
              </p>
            </div>
          </div>

          {/* Demographic Adjustments */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Demographic Adjustments (-100 to +150 points)</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-3">
              Medical schools use holistic review and actively recruit diverse student bodies.
              These adjustments reflect documented acceptance rate differences.
            </p>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-slate-700">
                    <th className="text-left py-2">Factor</th>
                    <th className="text-right py-2">Adjustment</th>
                    <th className="text-left py-2 pl-4">Source</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">Race/Ethnicity</td>
                    <td className="text-right">-50 to +100</td>
                    <td className="pl-4 text-slate-600 dark:text-slate-400">Odds ratio from AAMC data</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">First-Generation</td>
                    <td className="text-right">+15</td>
                    <td className="pl-4 text-slate-600 dark:text-slate-400">Holistic review consideration</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">Disadvantaged Background</td>
                    <td className="text-right">+20</td>
                    <td className="pl-4 text-slate-600 dark:text-slate-400">SES indicators</td>
                  </tr>
                  <tr>
                    <td className="py-2">Rural Background</td>
                    <td className="text-right">+15</td>
                    <td className="pl-4 text-slate-600 dark:text-slate-400">Rural health mission alignment</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-slate-500 mt-3">
                Race/ethnicity adjustments are based on published odds ratios from BMC Medical Education studies
                analyzing AAMC data.
              </p>
            </div>
          </div>

          {/* Red Flag Penalties */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Red Flag Penalties (0 to -100 points)</h3>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b dark:border-slate-700">
                    <th className="text-left py-2">Factor</th>
                    <th className="text-right py-2">Penalty</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">Institutional Action</td>
                    <td className="text-right text-red-600">-40</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">Criminal History</td>
                    <td className="text-right text-red-600">-30</td>
                  </tr>
                  <tr className="border-b dark:border-slate-700">
                    <td className="py-2">Reapplicant Status</td>
                    <td className="text-right text-red-600">-10</td>
                  </tr>
                  <tr>
                    <td className="py-2">Clinical Hours &lt;100</td>
                    <td className="text-right text-red-600">-10 to -20</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Score Tiers */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Score Tiers</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded p-3 text-center">
                <div className="font-semibold text-green-700 dark:text-green-400">Exceptional</div>
                <div className="text-sm">750+</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3 text-center">
                <div className="font-semibold text-blue-700 dark:text-blue-400">Strong</div>
                <div className="text-sm">600-749</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded p-3 text-center">
                <div className="font-semibold text-yellow-700 dark:text-yellow-400">Competitive</div>
                <div className="text-sm">450-599</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded p-3 text-center">
                <div className="font-semibold text-orange-700 dark:text-orange-400">Below Avg</div>
                <div className="text-sm">300-449</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 text-center">
                <div className="font-semibold text-red-700 dark:text-red-400">Low</div>
                <div className="text-sm">&lt;300</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WARS Score Section */}
      <Card>
        <CardHeader>
          <CardTitle>WARS Score (0-121)</CardTitle>
          <CardDescription>WedgeDawg Applicant Rating System</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            WARS is a standardized scoring system created by the Student Doctor Network community member
            WedgeDawg. It provides a quick assessment of applicant competitiveness using a formula-based approach.
          </p>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <div className="text-slate-600 dark:text-slate-400 mb-2">Formula:</div>
            <code>
              (Stats×5) + (Research×3) + Clinical + Shadowing + (Volunteering×2) +
              (Leadership×2) + (Misc×3) + Undergraduate + URM + Trend
            </code>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Component Breakdown</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-700">
                  <th className="text-left py-2">Component</th>
                  <th className="text-right py-2">Range</th>
                  <th className="text-left py-2 pl-4">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Stats (×5)</td>
                  <td className="text-right">0-50</td>
                  <td className="pl-4 text-slate-600 dark:text-slate-400">GPA/MCAT grid lookup</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Research (×3)</td>
                  <td className="text-right">0-15</td>
                  <td className="pl-4 text-slate-600 dark:text-slate-400">Level 1-5 based on hours + publications</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Clinical</td>
                  <td className="text-right">-10 to +9</td>
                  <td className="pl-4 text-slate-600 dark:text-slate-400">&lt;100h = -10, 100-500h = +5, 500+ = +9</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Shadowing</td>
                  <td className="text-right">-5 to +6</td>
                  <td className="pl-4 text-slate-600 dark:text-slate-400">&lt;40h = -5, 40+ = +6</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Volunteering (×2)</td>
                  <td className="text-right">0-6</td>
                  <td className="pl-4 text-slate-600 dark:text-slate-400">Level 1-3 based on hours</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Leadership (×2)</td>
                  <td className="text-right">0-6</td>
                  <td className="pl-4 text-slate-600 dark:text-slate-400">Level 1-3 based on roles</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Miscellaneous (×3)</td>
                  <td className="text-right">0-12</td>
                  <td className="pl-4 text-slate-600 dark:text-slate-400">Awards, unique experiences</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Undergraduate</td>
                  <td className="text-right">0-6</td>
                  <td className="pl-4 text-slate-600 dark:text-slate-400">HYPSM=6, Elite=3, Standard=0</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">URM</td>
                  <td className="text-right">0-7</td>
                  <td className="pl-4 text-slate-600 dark:text-slate-400">URM = +7</td>
                </tr>
                <tr>
                  <td className="py-2">Trend</td>
                  <td className="text-right">0-4</td>
                  <td className="pl-4 text-slate-600 dark:text-slate-400">Upward GPA trend = +4</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="font-medium mb-2">WARS Levels</h4>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
              <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 rounded p-2 text-center">
                <div className="font-bold text-purple-700 dark:text-purple-400">S</div>
                <div>85+</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded p-2 text-center">
                <div className="font-bold text-blue-700 dark:text-blue-400">A</div>
                <div>80-84</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded p-2 text-center">
                <div className="font-bold text-green-700 dark:text-green-400">B</div>
                <div>75-79</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded p-2 text-center">
                <div className="font-bold text-yellow-700 dark:text-yellow-400">C</div>
                <div>68-74</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded p-2 text-center">
                <div className="font-bold text-orange-700 dark:text-orange-400">D</div>
                <div>60-67</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded p-2 text-center">
                <div className="font-bold text-red-700 dark:text-red-400">E</div>
                <div>&lt;60</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-School Probability Section */}
      <Card>
        <CardHeader>
          <CardTitle>Per-School Probability Calculation</CardTitle>
          <CardDescription>How we estimate your chances at each school</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            Each school receives an individualized probability calculation based on multiple factors.
          </p>

          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium">1. School Baseline Rate</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Start with the school&apos;s actual acceptance rate (total accepted / total applicants).
              </p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium">2. Applicant Strength Multiplier</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Based on AAMC Table A-23 acceptance rates for your GPA/MCAT bin.
                Higher AAMC rates indicate stronger applicants who perform better across all schools.
              </p>
              <ul className="text-sm mt-1 space-y-1">
                <li>&gt;70% AAMC rate: 1.5× multiplier</li>
                <li>50-70%: 1.25× multiplier</li>
                <li>30-50%: 1.0× multiplier</li>
                <li>15-30%: 0.8× multiplier</li>
                <li>&lt;15%: 0.4-0.6× multiplier</li>
              </ul>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium">3. School Fit Adjustment</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Compare your stats to the school&apos;s median GPA and MCAT.
                Above median = boost, below median = penalty.
              </p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium">4. State Residency</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Public schools often have strong in-state preferences. We categorize schools as:
              </p>
              <ul className="text-sm mt-1 space-y-1">
                <li><strong>OOS-Friendly:</strong> No penalty</li>
                <li><strong>Neutral:</strong> 0.8× for OOS applicants</li>
                <li><strong>Unfriendly:</strong> 0.4× for OOS applicants</li>
                <li><strong>Hostile:</strong> 0.15× for OOS applicants</li>
              </ul>
              <p className="text-sm mt-2 text-slate-600 dark:text-slate-400">
                In-state at public schools: Up to 5× boost based on actual in-state vs OOS acceptance rates.
              </p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium">5. Demographic Adjustment</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Apply odds ratios for race/ethnicity, first-generation, and disadvantaged status.
              </p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium">6. Mission Fit Bonus</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Bonuses for alignment with school mission keywords (rural-health, underserved, research,
                primary-care, diversity, HBCU).
              </p>
            </div>

            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium">7. Experience Adjustment</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Adjust based on clinical hours, research hours, volunteering, shadowing, and leadership.
                Strong experiences can boost probability by 30%+; weak experiences can reduce by 70%.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <h4 className="font-medium mb-2">School Categories</h4>
            <ul className="text-sm space-y-1">
              <li><strong>Reach:</strong> &lt;15% probability</li>
              <li><strong>Target:</strong> 15-40% probability</li>
              <li><strong>Safety:</strong> &gt;40% probability</li>
            </ul>
            <p className="text-xs text-slate-500 mt-2">
              Categories may be adjusted based on stats vs school medians and OOS friendliness.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Calibration Section */}
      <Card>
        <CardHeader>
          <CardTitle>Probability Calibration</CardTitle>
          <CardDescription>Ensuring realistic expected outcomes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            Raw probability calculations need calibration to produce realistic expected acceptances.
            Our calibration system ensures predictions match observed outcomes for well-constructed school lists.
          </p>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-3">
            <h4 className="font-medium">Target Expected Acceptances (20-school list)</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-700">
                  <th className="text-left py-2">Applicant Strength</th>
                  <th className="text-right py-2">Base Target</th>
                  <th className="text-right py-2">Maximum</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Exceptional (GPA ≥3.85, MCAT ≥518, AAMC ≥75%)</td>
                  <td className="text-right">4.0</td>
                  <td className="text-right">7.0</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Strong (GPA ≥3.7, MCAT ≥512, AAMC ≥55%)</td>
                  <td className="text-right">3.0</td>
                  <td className="text-right">5.0</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Average (AAMC ≥35%)</td>
                  <td className="text-right">2.0</td>
                  <td className="text-right">4.0</td>
                </tr>
                <tr>
                  <td className="py-2">Weak (AAMC &lt;35%)</td>
                  <td className="text-right">0.8</td>
                  <td className="text-right">2.0</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">Calibration Factors</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li><strong>Number of Schools:</strong> More schools = more acceptances with diminishing returns
                (35 schools ≈ 1.5× expected acceptances vs 20 schools)</li>
              <li><strong>URM Demographic Boost:</strong> +30-50% expected acceptances for URM applicants</li>
              <li><strong>Tier-Specific Scaling:</strong> Reaches scaled at 0.92×, targets at 1.0×, safeties at 1.08×</li>
              <li><strong>In-State Public Floor:</strong> Exceptional applicants get 70% floor at in-state publics</li>
              <li><strong>Top School Caps:</strong> Even exceptional applicants capped at 35% for tier-1 schools</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Monte Carlo Section */}
      <Card>
        <CardHeader>
          <CardTitle>Monte Carlo Simulation</CardTitle>
          <CardDescription>Simulating thousands of application cycles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-slate-600 dark:text-slate-400">
            We run 10,000 simulated application cycles to estimate outcome distributions and
            calculate the probability of various scenarios.
          </p>

          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Simulation Process</h4>
              <ol className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-decimal pl-4">
                <li>For each school, look up that school&apos;s interview-to-acceptance rate from MSAR data</li>
                <li>Calculate interview probability: P(interview) = P(acceptance) / school_rate</li>
                <li>Roll a random number to determine if interview is received</li>
                <li>If interviewed, roll again using the school&apos;s actual rate to determine acceptance</li>
                <li>Repeat for all schools in the list</li>
                <li>Record total interviews and acceptances for this cycle</li>
                <li>Repeat 10,000 times</li>
              </ol>
            </div>

            <div>
              <h4 className="font-medium mb-2">Output Metrics</h4>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li><strong>Expected Interviews:</strong> Mean across all simulations</li>
                <li><strong>Expected Acceptances:</strong> Mean across all simulations</li>
                <li><strong>P(At Least One):</strong> % of simulations with ≥1 acceptance</li>
                <li><strong>Distributions:</strong> 10th, 25th, 50th, 75th, 90th percentiles</li>
                <li><strong>Probability Buckets:</strong> % with 0, 1, 2-3, 4+ acceptances</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">Outcome Scenarios</h4>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                <li><strong>Modal:</strong> Most frequently occurring exact outcome pattern</li>
                <li><strong>Optimistic:</strong> Scenario with most acceptances that occurred</li>
                <li><strong>Pessimistic:</strong> Scenario with fewest acceptances</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2">Per-School Interview-to-Acceptance Rates</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Medical schools have vastly different interviewing strategies. We use actual MSAR data
              for each school&apos;s interview-to-acceptance rate rather than a fixed national average.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white dark:bg-slate-800 rounded p-2">
                <span className="font-medium">Selective Interviewers</span>
                <ul className="mt-1 text-slate-500 dark:text-slate-400">
                  <li>Michigan: 82%</li>
                  <li>Illinois: 88%</li>
                  <li>Toledo: 87%</li>
                  <li>Howard: 82%</li>
                </ul>
              </div>
              <div className="bg-white dark:bg-slate-800 rounded p-2">
                <span className="font-medium">Broad Interviewers</span>
                <ul className="mt-1 text-slate-500 dark:text-slate-400">
                  <li>NYU: 21%</li>
                  <li>Harvard: 26%</li>
                  <li>Mayo: 27%</li>
                  <li>Baylor: 26%</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Schools with missing data use 45% (national average) as fallback.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Limitations Section */}
      <Card>
        <CardHeader>
          <CardTitle>Limitations & Caveats</CardTitle>
          <CardDescription>Understanding what this model cannot capture</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="border-l-4 border-amber-500 pl-4">
              <h4 className="font-medium text-amber-700 dark:text-amber-400">Holistic Review</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Medical schools evaluate applications holistically. Personal statements, letters of recommendation,
                and interview performance significantly impact outcomes but cannot be quantified by our model.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h4 className="font-medium text-amber-700 dark:text-amber-400">Institutional Priorities</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Schools have varying priorities each cycle based on class composition goals,
                yield predictions, and institutional needs that change year to year.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h4 className="font-medium text-amber-700 dark:text-amber-400">Historical Data</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Our model is based on historical aggregate data. Past patterns may not perfectly
                predict future outcomes as admission standards and processes evolve.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h4 className="font-medium text-amber-700 dark:text-amber-400">Individual Variation</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Probabilities represent statistical likelihoods, not guarantees. Your actual outcome
                may differ significantly from predictions due to factors unique to your application.
              </p>
            </div>

            <div className="border-l-4 border-amber-500 pl-4">
              <h4 className="font-medium text-amber-700 dark:text-amber-400">Experience Quality</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                We measure experience quantity (hours), but quality and depth of experiences matter
                more to admissions committees than hours alone.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Sources Section */}
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
          <CardDescription>Where our data comes from</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div>
                <strong>AAMC Table A-23</strong>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Acceptance rates by GPA/MCAT combinations (2021-2024 cycles)
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div>
                <strong>AAMC Table A-18</strong>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Demographic acceptance rate data
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div>
                <strong>Medical School Admission Requirements (MSAR)</strong>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Individual school statistics, medians, and class profiles
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div>
                <strong>BMC Medical Education Studies</strong>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Published research on URM acceptance odds ratios
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div>
                <strong>WedgeDawg WARS System</strong>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Community-developed applicant rating system from Student Doctor Network
                </p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-slate-500 py-8">
        <p>
          Have questions about our methodology?{' '}
          <Link href="mailto:support@medadmit.com" className="text-blue-600 hover:underline">
            Contact us
          </Link>
        </p>
        <p className="mt-2">
          <Link href="/profiles" className="text-blue-600 hover:underline">
            Start a Prediction
          </Link>
          {' '}&middot;{' '}
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Home
          </Link>
        </p>
      </div>
    </div>
  )
}
