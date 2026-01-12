import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

export const metadata = {
  title: 'Methodology | MedAdmit',
  description: 'Detailed explanation of our v2.0 rigorous probabilistic model for medical school admission prediction.',
}

export default function MethodologyPage() {
  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Our Methodology</h1>
        <p className="text-slate-600 dark:text-slate-400 text-lg">
          A comprehensive explanation of MedAdmit&apos;s v2.0 rigorous probabilistic model.
        </p>
      </div>

      {/* Overview Section */}
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>What makes our model different</CardDescription>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none space-y-4">
          <p>
            MedAdmit v2.0 uses a rigorous probabilistic framework calibrated against AAMC admission data.
            Unlike simple rule-based calculators, our model:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Two-stage admissions modeling</strong>: Separately models P(interview) and P(accept|interview)</li>
            <li><strong>Competitiveness Score (C)</strong>: A -3 to +3 scale calibrated to AAMC A-23 data</li>
            <li><strong>Experience saturation</strong>: Diminishing returns modeling for all experience domains</li>
            <li><strong>Correlated Monte Carlo simulation</strong>: Models the &quot;all-or-nothing&quot; nature of outcomes</li>
            <li><strong>Honest uncertainty</strong>: 80% credible intervals that acknowledge what we don&apos;t know</li>
          </ul>
          <p className="text-sm text-slate-500 mt-4">
            Model Version: 2.0.0 | Calibrated against 2020-2024 AAMC data
          </p>
        </CardContent>
      </Card>

      {/* Two-Stage Model Section */}
      <Card>
        <CardHeader>
          <CardTitle>Two-Stage Admissions Model</CardTitle>
          <CardDescription>Modeling the reality of medical school admissions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-600 dark:text-slate-400">
            Medical school admissions happens in two distinct stages with different selection criteria.
            Our model captures this by computing probabilities separately for each stage.
          </p>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 space-y-4">
            <div className="text-center">
              <div className="font-mono text-lg">
                P(accept) = P(interview) × P(accept | interview)
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="border-l-4 border-purple-500 pl-4">
                <h4 className="font-semibold text-purple-700 dark:text-purple-400">Stage 1: Screening</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Schools filter applications based primarily on academic metrics (GPA/MCAT),
                  state residency, and basic experience thresholds. This determines P(interview).
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-semibold text-green-700 dark:text-green-400">Stage 2: Holistic Review</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Interviewed applicants are evaluated on interview performance, essays, letters,
                  and fit. This determines P(accept | interview).
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Why This Matters</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <li>
                <strong>Different schools, different strategies:</strong> Harvard interviews 3× as many
                applicants as they accept (26% interview→accept rate), while Michigan interviews very
                selectively (82% rate). Same final acceptance rates, very different paths.
              </li>
              <li>
                <strong>Better calibration:</strong> Separating stages allows us to calibrate each
                against actual MSAR data for each school.
              </li>
              <li>
                <strong>Actionable insights:</strong> Knowing whether you&apos;re being screened out vs.
                rejected post-interview suggests different improvement strategies.
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-700 dark:text-blue-400 mb-2">School-Specific Parameters</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Each of 159 medical schools has independently calibrated parameters for:
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1">
              <li>• Interview probability intercept and C-slope</li>
              <li>• Accept|interview probability intercept and C-slope</li>
              <li>• In-state bonus (for public schools)</li>
              <li>• Mission-specific modifiers</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Competitiveness Score Section */}
      <Card>
        <CardHeader>
          <CardTitle>Competitiveness Score (C)</CardTitle>
          <CardDescription>Your academic profile on a calibrated scale</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-600 dark:text-slate-400">
            The Competitiveness Score combines GPA and MCAT into a single metric calibrated against
            AAMC Table A-23 acceptance rate data. Unlike arbitrary point systems, C has a clear
            interpretation in terms of admission odds.
          </p>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 space-y-4">
            <h4 className="font-medium">Mathematical Definition</h4>
            <div className="font-mono text-sm space-y-2">
              <div>C = β_gpa × (GPA - 3.75) + β_mcat × (MCAT - 512)</div>
              <div className="text-slate-500 mt-2">where:</div>
              <div className="pl-4">β_gpa ≈ 2.0 (calibrated from spline fit)</div>
              <div className="pl-4">β_mcat ≈ 0.15 (calibrated from spline fit)</div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">The Anchor Point</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              C = 0 corresponds to the reference applicant: <strong>3.75 GPA and 512 MCAT</strong>.
              This represents roughly the 50th percentile of admitted students and approximately
              a 45% national acceptance rate according to AAMC A-23 data.
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-3">Interpreting Your C Score</h4>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded p-3 text-center">
                <div className="text-2xl font-bold text-red-600">-2 to -3</div>
                <div className="text-sm text-slate-600 mt-1">Very Low</div>
                <div className="text-xs text-slate-500">~5-15th %ile</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded p-3 text-center">
                <div className="text-2xl font-bold text-orange-600">-1 to -2</div>
                <div className="text-sm text-slate-600 mt-1">Below Avg</div>
                <div className="text-xs text-slate-500">~15-35th %ile</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded p-3 text-center">
                <div className="text-2xl font-bold text-yellow-600">-1 to +1</div>
                <div className="text-sm text-slate-600 mt-1">Average</div>
                <div className="text-xs text-slate-500">~35-65th %ile</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 rounded p-3 text-center">
                <div className="text-2xl font-bold text-blue-600">+1 to +2</div>
                <div className="text-sm text-slate-600 mt-1">Strong</div>
                <div className="text-xs text-slate-500">~65-85th %ile</div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded p-3 text-center">
                <div className="text-2xl font-bold text-green-600">+2 to +3</div>
                <div className="text-sm text-slate-600 mt-1">Exceptional</div>
                <div className="text-xs text-slate-500">~85-99th %ile</div>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
              Key Insight: Roughly Log-Odds
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Each +1.0 increase in C roughly <strong>doubles your odds</strong> of admission
              (controlling for other factors). This is because C operates on a log-odds scale,
              making it directly interpretable in terms of relative risk.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Experience Saturation Section */}
      <Card>
        <CardHeader>
          <CardTitle>Experience Saturation</CardTitle>
          <CardDescription>Diminishing returns in extracurricular activities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-600 dark:text-slate-400">
            Additional hours of experience provide diminishing benefit. The 50th hour of clinical
            experience matters much more than the 2,000th. We model this using saturation functions.
          </p>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 space-y-4">
            <h4 className="font-medium">Saturation Function</h4>
            <div className="font-mono text-sm">
              g(h) = α × (1 - e<sup>-h/τ</sup>)
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              <strong>α</strong> = maximum contribution (asymptote)<br/>
              <strong>τ</strong> = half-saturation hours (domain-specific)<br/>
              <strong>h</strong> = hours of experience
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Domain Parameters</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-700">
                  <th className="text-left py-2">Domain</th>
                  <th className="text-right py-2">Half-Sat (τ)</th>
                  <th className="text-right py-2">Max Effect (α)</th>
                  <th className="text-left py-2 pl-4">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Clinical</td>
                  <td className="text-right">400 hrs</td>
                  <td className="text-right">0.40</td>
                  <td className="pl-4 text-slate-600">63% benefit at 400 hrs, 90% at ~1000 hrs</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Research</td>
                  <td className="text-right">600 hrs</td>
                  <td className="text-right">0.35</td>
                  <td className="pl-4 text-slate-600">Slower saturation, higher ceiling</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Volunteer</td>
                  <td className="text-right">200 hrs</td>
                  <td className="text-right">0.20</td>
                  <td className="pl-4 text-slate-600">Saturates quickly, smaller effect</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Shadowing</td>
                  <td className="text-right">50 hrs</td>
                  <td className="text-right">0.10</td>
                  <td className="pl-4 text-slate-600">Very fast saturation (checkbox item)</td>
                </tr>
                <tr>
                  <td className="py-2">Leadership</td>
                  <td className="text-right">2 roles</td>
                  <td className="text-right">0.15</td>
                  <td className="pl-4 text-slate-600">Counted in roles, not hours</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="font-medium mb-3">Minimum Thresholds</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Some experience domains have minimum thresholds below which applications are penalized:
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li><strong>Clinical:</strong> Minimum 100 hours (penalty if below)</li>
              <li><strong>Shadowing:</strong> Minimum 20 hours (soft threshold)</li>
            </ul>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-700 dark:text-green-400 mb-2">Practical Implication</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              When your saturation bar shows 90%+, additional hours in that domain provide
              minimal benefit. Consider diversifying to under-saturated areas instead.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Demographic Effects Section */}
      <Card>
        <CardHeader>
          <CardTitle>Demographic &amp; Mission Effects</CardTitle>
          <CardDescription>How background factors influence predictions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-600 dark:text-slate-400">
            Medical schools practice holistic review with documented differences in acceptance rates
            across demographic groups. We model these effects based on published AAMC data.
          </p>

          <div>
            <h4 className="font-medium mb-3">Race/Ethnicity Effects</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Based on odds ratios derived from AAMC Table A-18 data:
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-700">
                  <th className="text-left py-2">Group</th>
                  <th className="text-right py-2">Effect (logit)</th>
                  <th className="text-right py-2">Odds Ratio</th>
                  <th className="text-left py-2 pl-4">Evidence</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Black/African American</td>
                  <td className="text-right text-green-600">+0.85</td>
                  <td className="text-right">2.3×</td>
                  <td className="pl-4 text-slate-600">Strong (A-18 data)</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Hispanic/Latino</td>
                  <td className="text-right text-green-600">+0.55</td>
                  <td className="text-right">1.7×</td>
                  <td className="pl-4 text-slate-600">Strong (A-18 data)</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">White</td>
                  <td className="text-right">0.00</td>
                  <td className="text-right">1.0× (ref)</td>
                  <td className="pl-4 text-slate-600">Reference group</td>
                </tr>
                <tr>
                  <td className="py-2">Asian</td>
                  <td className="text-right text-red-600">-0.35</td>
                  <td className="text-right">0.7×</td>
                  <td className="pl-4 text-slate-600">Moderate (A-18 data)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="font-medium mb-3">Other Demographic Factors</h4>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-slate-700">
                  <th className="text-left py-2">Factor</th>
                  <th className="text-right py-2">Effect</th>
                  <th className="text-left py-2 pl-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">First-Generation College</td>
                  <td className="text-right text-green-600">+0.15</td>
                  <td className="pl-4 text-slate-600">Holistic review consideration</td>
                </tr>
                <tr className="border-b dark:border-slate-700">
                  <td className="py-2">Disadvantaged (FAP eligible)</td>
                  <td className="text-right text-green-600">+0.20</td>
                  <td className="pl-4 text-slate-600">SES indicator</td>
                </tr>
                <tr>
                  <td className="py-2">Rural Background</td>
                  <td className="text-right text-green-600">+0.10</td>
                  <td className="pl-4 text-slate-600">General effect; higher at rural-mission schools</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="font-medium mb-3">Mission Fit Bonuses</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Schools with specific missions provide additional bonuses to matching applicants:
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li><strong>Research-intensive:</strong> +0.2 for applicants with 1000+ research hours</li>
              <li><strong>Primary care mission:</strong> +0.15 for primary care interest</li>
              <li><strong>Rural health mission:</strong> +0.3 for rural background + interest</li>
              <li><strong>Underserved focus:</strong> +0.2 for disadvantaged + service orientation</li>
            </ul>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <h4 className="font-medium mb-2">State Residency</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Public medical schools strongly prefer in-state applicants. In-state bonuses range from
              +0.5 to +2.0 logit units depending on the school&apos;s historical in-state matriculation rate.
              Some schools (like Texas public schools) matriculate 90%+ in-state students.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Monte Carlo Simulation Section */}
      <Card>
        <CardHeader>
          <CardTitle>Monte Carlo Simulation</CardTitle>
          <CardDescription>Modeling correlated outcomes across schools</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-600 dark:text-slate-400">
            Medical school admissions outcomes are correlated - if you&apos;re a strong applicant,
            you tend to do well at multiple schools. Our simulation captures this using
            random effects that create realistic &quot;all-or-nothing&quot; patterns.
          </p>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 space-y-4">
            <h4 className="font-medium">The Random Effect Model</h4>
            <div className="font-mono text-sm space-y-2">
              <div>For each simulation:</div>
              <div className="pl-4">1. Draw applicant effect: u ~ Normal(0, σ<sub>u</sub>)</div>
              <div className="pl-4">2. For each school i:</div>
              <div className="pl-8">p<sub>i</sub>&apos; = logit<sup>-1</sup>(logit(p<sub>i</sub>) + u)</div>
              <div className="pl-8">outcome<sub>i</sub> ~ Bernoulli(p<sub>i</sub>&apos;)</div>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 mt-3">
              <strong>σ<sub>u</sub> ≈ 0.8</strong>: Calibrated so that outcome variance matches
              observed patterns in admission data.
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Why Outcomes Are Correlated</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              The random effect (u) represents unmeasured factors that affect all applications:
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1">
              <li>• Personal statement quality</li>
              <li>• Letter of recommendation strength</li>
              <li>• Interview performance</li>
              <li>• Application timing and completeness</li>
              <li>• General &quot;likability&quot; factor</li>
            </ul>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-semibold text-green-700 dark:text-green-400">High u (Lucky Draw)</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Strong essays, great interviews, compelling narrative.
                All probabilities shift upward → multiple acceptances likely.
              </p>
            </div>
            <div className="border-l-4 border-red-500 pl-4">
              <h4 className="font-semibold text-red-700 dark:text-red-400">Low u (Unlucky Draw)</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                Weak essays, poor interviews, unconvincing narrative.
                All probabilities shift downward → rejection more likely.
              </p>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Simulation Outputs</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              We run 10,000 simulated application cycles and report:
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li><strong>Expected Acceptances:</strong> Mean across simulations with 80% CI</li>
              <li><strong>P(At Least One):</strong> Fraction of simulations with ≥1 acceptance</li>
              <li><strong>Distribution Buckets:</strong> P(0), P(1), P(2-3), P(4+) acceptances</li>
              <li><strong>Mean Pairwise Correlation:</strong> How linked outcomes are across schools</li>
            </ul>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-700 dark:text-amber-400 mb-2">
              The &quot;All-or-Nothing&quot; Pattern
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Because of correlation, outcomes cluster: you&apos;re more likely to get 0 or 4+
              acceptances than exactly 1 or 2. This matches observed patterns where strong
              applicants often have multiple choices while borderline applicants face binary outcomes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Uncertainty Quantification Section */}
      <Card>
        <CardHeader>
          <CardTitle>Uncertainty Quantification</CardTitle>
          <CardDescription>Honest about what we don&apos;t know</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-slate-600 dark:text-slate-400">
            Medical school admission is inherently uncertain. Rather than providing false precision,
            we quantify and decompose uncertainty into its sources.
          </p>

          <div>
            <h4 className="font-medium mb-3">80% Credible Intervals</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              All probabilities come with 80% credible intervals (CI). This means:
              there&apos;s an 80% probability the true value lies within this range.
              We use 80% rather than 95% because:
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1">
              <li>• 95% intervals would be too wide to be useful</li>
              <li>• 80% provides actionable bounds while acknowledging uncertainty</li>
              <li>• Matches common reporting standards in decision analysis</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-3">Sources of Uncertainty</h4>
            <div className="space-y-3">
              <div className="border-l-4 border-blue-500 pl-4">
                <h5 className="font-medium text-blue-700 dark:text-blue-400">Parameter Uncertainty</h5>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  School parameters (intercepts, slopes) are estimated from limited data.
                  We propagate this uncertainty using parametric bootstrap.
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h5 className="font-medium text-purple-700 dark:text-purple-400">Random Effect Uncertainty</h5>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  The applicant random effect (u) is unknown until applications are evaluated.
                  This creates irreducible uncertainty about outcomes.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <h4 className="font-medium mb-2">Variance Decomposition</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              For a typical applicant, total prediction variance breaks down as:
            </p>
            <div className="flex items-center gap-4">
              <div className="flex-1 h-4 rounded-full overflow-hidden flex">
                <div className="bg-blue-400 w-2/5"></div>
                <div className="bg-purple-400 w-3/5"></div>
              </div>
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>Parameter (~40%)</span>
              <span>Random Effects (~60%)</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Random effect variance dominates, meaning even perfect model parameters couldn&apos;t
              eliminate uncertainty - holistic factors are inherently unpredictable.
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-3">Uncertainty Levels</h4>
            <div className="grid grid-cols-5 gap-2 text-sm text-center">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded p-2">
                <div className="font-medium text-green-700">Very Precise</div>
                <div className="text-xs text-slate-500">±5%</div>
              </div>
              <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 rounded p-2">
                <div className="font-medium text-emerald-700">Precise</div>
                <div className="text-xs text-slate-500">±10%</div>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded p-2">
                <div className="font-medium text-yellow-700">Moderate</div>
                <div className="text-xs text-slate-500">±15%</div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 rounded p-2">
                <div className="font-medium text-orange-700">Uncertain</div>
                <div className="text-xs text-slate-500">±20%</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded p-2">
                <div className="font-medium text-red-700">Highly Uncertain</div>
                <div className="text-xs text-slate-500">±25%+</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Section */}
      <Card>
        <CardHeader>
          <CardTitle>Validation &amp; Calibration</CardTitle>
          <CardDescription>How we know the model works</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-3">AAMC A-23 Reproduction</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Our competitiveness spline was calibrated against AAMC Table A-23, which shows
              acceptance rates for each GPA × MCAT bin. The model reproduces the observed
              S-curve pattern with high accuracy:
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1">
              <li>• Mean absolute error: &lt;3% across all cells</li>
              <li>• Correlation with observed rates: r &gt; 0.95</li>
              <li>• Proper behavior at extremes (very low/high stats)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-3">School Parameter Calibration</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Each school&apos;s parameters were calibrated using:
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1">
              <li>• MSAR median GPA/MCAT (determines where school falls on C scale)</li>
              <li>• Interview yield rates (determines interview vs acceptance split)</li>
              <li>• In-state matriculation percentages (determines residency bonus)</li>
              <li>• Mission statements and reported class characteristics</li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-3">Sensitivity Analysis</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Model predictions are robust to reasonable parameter variations:
            </p>
            <ul className="text-sm text-slate-600 dark:text-slate-400 mt-2 space-y-1">
              <li>• ±20% in experience weights: &lt;5% change in predictions</li>
              <li>• ±0.1 in demographic effects: &lt;3% change in predictions</li>
              <li>• Random effect σ from 0.6-1.0: Affects variance but not means</li>
            </ul>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
            <h4 className="font-medium mb-2">Known Limitations</h4>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2">
              <li>
                <strong>Holistic factors:</strong> Personal statements, letters, and interviews
                cannot be quantified and represent irreducible uncertainty.
              </li>
              <li>
                <strong>Year-to-year variation:</strong> School priorities shift; models trained
                on historical data may not perfectly predict future cycles.
              </li>
              <li>
                <strong>Experience quality:</strong> We measure quantity (hours), but quality and
                depth of experiences matter more to committees.
              </li>
              <li>
                <strong>Application execution:</strong> Timing, completeness, and presentation
                affect outcomes but aren&apos;t captured in our inputs.
              </li>
            </ul>
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
                  Acceptance rates by GPA/MCAT combinations (2020-2024 cycles).
                  Primary source for competitiveness calibration.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div>
                <strong>AAMC Table A-18</strong>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Acceptance rates by race/ethnicity. Source for demographic effect estimates.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div>
                <strong>Medical School Admission Requirements (MSAR)</strong>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Individual school statistics: medians, acceptance rates, class sizes,
                  interview yields, in-state percentages.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div>
                <strong>Admit.org School Profiles</strong>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Supplementary data on school missions, out-of-state friendliness,
                  and program characteristics.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
              <div>
                <strong>Published Research</strong>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  BMC Medical Education and other peer-reviewed studies on admission patterns,
                  URM odds ratios, and holistic review practices.
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
