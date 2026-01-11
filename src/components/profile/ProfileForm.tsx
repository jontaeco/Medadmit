'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { US_STATES, RACE_ETHNICITY_CATEGORIES } from '@/types/data'

const profileSchema = z.object({
  profileName: z.string().min(1, 'Profile name is required'),

  // Academic
  cumulativeGPA: z.coerce.number().min(0).max(4.0),
  scienceGPA: z.coerce.number().min(0).max(4.0).optional().nullable(),
  mcatTotal: z.coerce.number().min(472).max(528),
  mcatCPBS: z.coerce.number().min(118).max(132).optional().nullable(),
  mcatCARS: z.coerce.number().min(118).max(132).optional().nullable(),
  mcatBBFL: z.coerce.number().min(118).max(132).optional().nullable(),
  mcatPSBB: z.coerce.number().min(118).max(132).optional().nullable(),

  // Demographics
  stateOfResidence: z.string().length(2),
  raceEthnicity: z.string().optional().nullable(),
  isFirstGeneration: z.boolean().default(false),
  isDisadvantaged: z.boolean().default(false),
  isRuralBackground: z.boolean().default(false),

  // Experiences
  clinicalHoursPaid: z.coerce.number().min(0).default(0),
  clinicalHoursVolunteer: z.coerce.number().min(0).default(0),
  researchHoursTotal: z.coerce.number().min(0).default(0),
  hasResearchPublications: z.boolean().default(false),
  publicationCount: z.coerce.number().min(0).default(0),
  volunteerHoursNonClinical: z.coerce.number().min(0).default(0),
  shadowingHours: z.coerce.number().min(0).default(0),
  leadershipExperiences: z.coerce.number().min(0).default(0),
  teachingHours: z.coerce.number().min(0).default(0),

  // Application
  isReapplicant: z.boolean().default(false),
  hasInstitutionalAction: z.boolean().default(false),
  hasCriminalHistory: z.boolean().default(false),

  // WARS-specific fields (optional)
  undergraduateSchoolTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().nullable(),
  gpaTrend: z.enum(['upward', 'flat', 'downward']).optional().nullable(),
  miscellaneousLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional().nullable(),
})

type ProfileFormData = z.infer<typeof profileSchema>

interface ProfileFormProps {
  initialData?: Partial<ProfileFormData>
  onSubmit: (data: ProfileFormData) => Promise<void>
  isLoading?: boolean
}

export function ProfileForm({ initialData, onSubmit, isLoading }: ProfileFormProps) {
  const [activeTab, setActiveTab] = useState('academic')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema) as any,
    defaultValues: {
      profileName: '',
      cumulativeGPA: 3.5,
      scienceGPA: null,
      mcatTotal: 510,
      mcatCPBS: null,
      mcatCARS: null,
      mcatBBFL: null,
      mcatPSBB: null,
      stateOfResidence: 'CA',
      raceEthnicity: null,
      isFirstGeneration: false,
      isDisadvantaged: false,
      isRuralBackground: false,
      clinicalHoursPaid: 0,
      clinicalHoursVolunteer: 0,
      researchHoursTotal: 0,
      hasResearchPublications: false,
      publicationCount: 0,
      volunteerHoursNonClinical: 0,
      shadowingHours: 0,
      leadershipExperiences: 0,
      teachingHours: 0,
      isReapplicant: false,
      hasInstitutionalAction: false,
      hasCriminalHistory: false,
      undergraduateSchoolTier: null,
      gpaTrend: null,
      miscellaneousLevel: null,
      ...initialData,
    },
  })

  const hasPublications = watch('hasResearchPublications')
  const stateOfResidence = watch('stateOfResidence')
  const raceEthnicity = watch('raceEthnicity')
  const mcatCPBS = watch('mcatCPBS')
  const mcatCARS = watch('mcatCARS')
  const mcatBBFL = watch('mcatBBFL')
  const mcatPSBB = watch('mcatPSBB')
  const undergraduateSchoolTier = watch('undergraduateSchoolTier')
  const gpaTrend = watch('gpaTrend')
  const miscellaneousLevel = watch('miscellaneousLevel')

  // Auto-calculate MCAT total from subsections
  useEffect(() => {
    const cpbs = mcatCPBS ? Number(mcatCPBS) : 0
    const cars = mcatCARS ? Number(mcatCARS) : 0
    const bbfl = mcatBBFL ? Number(mcatBBFL) : 0
    const psbb = mcatPSBB ? Number(mcatPSBB) : 0

    // Only auto-fill if all 4 subsections are entered
    if (cpbs > 0 && cars > 0 && bbfl > 0 && psbb > 0) {
      const total = cpbs + cars + bbfl + psbb
      setValue('mcatTotal', total)
    }
  }, [mcatCPBS, mcatCARS, mcatBBFL, mcatPSBB, setValue])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Show validation errors summary */}
      {Object.keys(errors).length > 0 && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm font-medium text-red-800">Please fix the following errors:</p>
          <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
            {errors.profileName && <li>Profile name is required</li>}
            {errors.cumulativeGPA && <li>Valid GPA is required (0-4.0)</li>}
            {errors.mcatTotal && <li>Valid MCAT total score is required (472-528)</li>}
            {errors.stateOfResidence && <li>State of residence is required</li>}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="profileName">Profile Name</Label>
        <Input
          id="profileName"
          {...register('profileName')}
          placeholder="e.g., My 2024 Application"
        />
        {errors.profileName && (
          <p className="text-sm text-red-600">{errors.profileName.message}</p>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="experiences">Experiences</TabsTrigger>
          <TabsTrigger value="other">Other</TabsTrigger>
        </TabsList>

        <TabsContent value="academic" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>GPA</CardTitle>
              <CardDescription>
                Enter your cumulative and science GPA (4.0 scale)
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cumulativeGPA">Cumulative GPA *</Label>
                <Input
                  id="cumulativeGPA"
                  type="number"
                  step="0.01"
                  min="0"
                  max="4.0"
                  {...register('cumulativeGPA')}
                />
                {errors.cumulativeGPA && (
                  <p className="text-sm text-red-600">{errors.cumulativeGPA.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="scienceGPA">Science GPA</Label>
                <Input
                  id="scienceGPA"
                  type="number"
                  step="0.01"
                  min="0"
                  max="4.0"
                  {...register('scienceGPA')}
                  placeholder="Optional"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>MCAT</CardTitle>
              <CardDescription>
                Enter your MCAT score (472-528). Total will auto-calculate from subsections.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mcatTotal">Total Score *</Label>
                <Input
                  id="mcatTotal"
                  type="number"
                  min="472"
                  max="528"
                  {...register('mcatTotal')}
                />
                {errors.mcatTotal && (
                  <p className="text-sm text-red-600">{errors.mcatTotal.message}</p>
                )}
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mcatCPBS">CP/BS</Label>
                  <Input
                    id="mcatCPBS"
                    type="number"
                    min="118"
                    max="132"
                    {...register('mcatCPBS')}
                    placeholder="118-132"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mcatCARS">CARS</Label>
                  <Input
                    id="mcatCARS"
                    type="number"
                    min="118"
                    max="132"
                    {...register('mcatCARS')}
                    placeholder="118-132"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mcatBBFL">BB/FL</Label>
                  <Input
                    id="mcatBBFL"
                    type="number"
                    min="118"
                    max="132"
                    {...register('mcatBBFL')}
                    placeholder="118-132"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mcatPSBB">PS/BB</Label>
                  <Input
                    id="mcatPSBB"
                    type="number"
                    min="118"
                    max="132"
                    {...register('mcatPSBB')}
                    placeholder="118-132"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="demographics" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Background Information</CardTitle>
              <CardDescription>
                This information helps us provide more accurate predictions based on historical data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>State of Residence *</Label>
                <Select
                  value={stateOfResidence}
                  onValueChange={(value) => setValue('stateOfResidence', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(US_STATES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Race/Ethnicity</Label>
                <Select
                  value={raceEthnicity ?? 'prefer_not_to_say'}
                  onValueChange={(value) => setValue('raceEthnicity', value === 'prefer_not_to_say' ? null : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    {RACE_ETHNICITY_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Used only for statistical accuracy based on AAMC data
                </p>
              </div>

              <div className="space-y-3 pt-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isFirstGeneration"
                    {...register('isFirstGeneration')}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <Label htmlFor="isFirstGeneration" className="font-normal">
                    First-generation college student
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isDisadvantaged"
                    {...register('isDisadvantaged')}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <Label htmlFor="isDisadvantaged" className="font-normal">
                    Economically or educationally disadvantaged background
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isRuralBackground"
                    {...register('isRuralBackground')}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <Label htmlFor="isRuralBackground" className="font-normal">
                    Rural background
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>WARS-Specific Information</CardTitle>
              <CardDescription>
                Optional fields for the WedgeDawg Applicant Rating System (WARS) scoring
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Undergraduate School Prestige</Label>
                <Select
                  value={undergraduateSchoolTier?.toString() ?? 'not_specified'}
                  onValueChange={(value) => setValue('undergraduateSchoolTier', value === 'not_specified' ? null : Number(value) as 1 | 2 | 3)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_specified">Not Specified</SelectItem>
                    <SelectItem value="1">Tier 1: HYPSM (Harvard, Yale, Princeton, Stanford, MIT)</SelectItem>
                    <SelectItem value="2">Tier 2: Elite (Other Ivies, top privates, top publics)</SelectItem>
                    <SelectItem value="3">Tier 3: All other schools</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Used for WARS school list distribution
                </p>
              </div>

              <div className="space-y-2">
                <Label>GPA Trend</Label>
                <Select
                  value={gpaTrend ?? 'not_specified'}
                  onValueChange={(value) => setValue('gpaTrend', value === 'not_specified' ? null : value as 'upward' | 'flat' | 'downward')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_specified">Not Specified</SelectItem>
                    <SelectItem value="upward">Upward (improved over time)</SelectItem>
                    <SelectItem value="flat">Flat (consistent throughout)</SelectItem>
                    <SelectItem value="downward">Downward (declined over time)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Pattern of your GPA across undergraduate years
                </p>
              </div>

              <div className="space-y-2">
                <Label>Miscellaneous Achievements</Label>
                <Select
                  value={miscellaneousLevel?.toString() ?? 'not_specified'}
                  onValueChange={(value) => setValue('miscellaneousLevel', value === 'not_specified' ? null : Number(value) as 1 | 2 | 3 | 4)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_specified">Not Specified</SelectItem>
                    <SelectItem value="1">Level 1: None or minimal</SelectItem>
                    <SelectItem value="2">Level 2: Moderate (notable hobbies, work experience)</SelectItem>
                    <SelectItem value="3">Level 3: Significant (PhD, JD, Peace Corps, military)</SelectItem>
                    <SelectItem value="4">Level 4: Outstanding (Rhodes, Olympics, professional sports)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Exceptional achievements beyond standard pre-med activities
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="experiences" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Clinical Experience</CardTitle>
              <CardDescription>
                Hours of direct patient contact experience
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clinicalHoursPaid">Paid Clinical (hours)</Label>
                <Input
                  id="clinicalHoursPaid"
                  type="number"
                  min="0"
                  {...register('clinicalHoursPaid')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinicalHoursVolunteer">Volunteer Clinical (hours)</Label>
                <Input
                  id="clinicalHoursVolunteer"
                  type="number"
                  min="0"
                  {...register('clinicalHoursVolunteer')}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Research Experience</CardTitle>
              <CardDescription>
                Laboratory, clinical, or other research experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="researchHoursTotal">Total Research Hours</Label>
                <Input
                  id="researchHoursTotal"
                  type="number"
                  min="0"
                  {...register('researchHoursTotal')}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasResearchPublications"
                  {...register('hasResearchPublications')}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Label htmlFor="hasResearchPublications" className="font-normal">
                  I have research publications
                </Label>
              </div>
              {hasPublications && (
                <div className="space-y-2">
                  <Label htmlFor="publicationCount">Number of Publications</Label>
                  <Input
                    id="publicationCount"
                    type="number"
                    min="0"
                    {...register('publicationCount')}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other Experiences</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="volunteerHoursNonClinical">Non-Clinical Volunteering (hours)</Label>
                <Input
                  id="volunteerHoursNonClinical"
                  type="number"
                  min="0"
                  {...register('volunteerHoursNonClinical')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shadowingHours">Physician Shadowing (hours)</Label>
                <Input
                  id="shadowingHours"
                  type="number"
                  min="0"
                  {...register('shadowingHours')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="leadershipExperiences">Leadership Roles (count)</Label>
                <Input
                  id="leadershipExperiences"
                  type="number"
                  min="0"
                  {...register('leadershipExperiences')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="teachingHours">Teaching/Tutoring (hours)</Label>
                <Input
                  id="teachingHours"
                  type="number"
                  min="0"
                  {...register('teachingHours')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Status</CardTitle>
              <CardDescription>
                Additional factors that may affect your application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isReapplicant"
                  {...register('isReapplicant')}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Label htmlFor="isReapplicant" className="font-normal">
                  I am a reapplicant
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasInstitutionalAction"
                  {...register('hasInstitutionalAction')}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Label htmlFor="hasInstitutionalAction" className="font-normal">
                  I have an institutional action on my record
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hasCriminalHistory"
                  {...register('hasCriminalHistory')}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Label htmlFor="hasCriminalHistory" className="font-normal">
                  I have a criminal/legal history to report
                </Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-4 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Saving...' : 'Save Profile'}
        </Button>
      </div>
    </form>
  )
}
