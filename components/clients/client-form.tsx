'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Collapsible } from '@/components/ui/collapsible'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  clientFormSchema,
  clientFormDefaultValues,
  type ClientFormValues,
} from '@/lib/clients/validators'
import { CLIENT_STATUSES } from '@/lib/clients/types'
import { createClientAction, updateClientAction } from '@/lib/actions/clients'

// ── Option lists ───────────────────────────────────────────────────────────

const INDUSTRY_OPTIONS = [
  'Technology',
  'Marketing & Advertising',
  'Design & Creative',
  'Finance',
  'Healthcare',
  'Education',
  'Real Estate',
  'Legal',
  'Consulting',
  'Retail & E-commerce',
  'Manufacturing',
  'Other',
]

const COMPANY_SIZE_OPTIONS = ['1–10', '11–50', '51–200', '201–500', '501–1000', '1000+']

const LEAD_SOURCE_OPTIONS = [
  'Referral',
  'LinkedIn',
  'Website',
  'Cold outreach',
  'Conference or event',
  'Social media',
  'Partner',
  'Job board',
  'Other',
]

const STATUS_LABELS: Record<string, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  proposal_sent: 'Proposal sent',
  negotiating: 'Negotiating',
  won: 'Won',
  lost: 'Lost',
}

// ── Types ──────────────────────────────────────────────────────────────────

export type ClientForEdit = {
  id: string
  companyName: string | null
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  industry: string | null
  companySize: string | null
  leadSource: string | null
  status: string
  projectType: string | null
  painPoints: string | null
  requirements: string | null
  opportunityNotes: string | null
  lastContactDate: string | null
  nextFollowupDate: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toFormValues(client: ClientForEdit): ClientFormValues {
  return {
    companyName: client.companyName ?? '',
    contactName: client.contactName ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    website: client.website ?? '',
    industry: client.industry ?? '',
    companySize: client.companySize ?? '',
    leadSource: client.leadSource ?? '',
    status: (client.status as ClientFormValues['status']) ?? 'lead',
    projectType: client.projectType ?? '',
    painPoints: client.painPoints ?? '',
    requirements: client.requirements ?? '',
    opportunityNotes: client.opportunityNotes ?? '',
    // Dates stored as ISO; date inputs expect YYYY-MM-DD
    lastContactDate: client.lastContactDate
      ? client.lastContactDate.slice(0, 10)
      : '',
    nextFollowupDate: client.nextFollowupDate
      ? client.nextFollowupDate.slice(0, 10)
      : '',
  }
}

function toActionPayload(values: ClientFormValues) {
  return {
    companyName: values.companyName || undefined,
    contactName: values.contactName || undefined,
    email: values.email || undefined,
    phone: values.phone || undefined,
    website: values.website || undefined,
    industry: values.industry || undefined,
    companySize: values.companySize || undefined,
    leadSource: values.leadSource || undefined,
    status: values.status,
    projectType: values.projectType || undefined,
    painPoints: values.painPoints || undefined,
    requirements: values.requirements || undefined,
    opportunityNotes: values.opportunityNotes || undefined,
    lastContactDate: values.lastContactDate || undefined,
    nextFollowupDate: values.nextFollowupDate || undefined,
  }
}

// ── Component ──────────────────────────────────────────────────────────────

interface ClientFormProps {
  client?: ClientForEdit
}

export function ClientForm({ client }: ClientFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const isEdit = !!client

  const intelligenceHasData = !!(
    client?.painPoints ||
    client?.requirements ||
    client?.opportunityNotes
  )

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client ? toFormValues(client) : clientFormDefaultValues,
  })

  const { formState: { errors } } = form

  async function onSubmit(values: ClientFormValues) {
    const payload = toActionPayload(values)

    startTransition(async () => {
      const result = isEdit
        ? await updateClientAction(client.id, payload)
        : await createClientAction(payload)

      if ('error' in result) {
        form.setError('root', { message: result.error })
        return
      }

      router.push('/clients')
      router.refresh()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
        {/* Root / server error */}
        {errors.root && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {errors.root.message}
          </div>
        )}

        {/* ── Section: Core info ──────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Contact information
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Company name */}
            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corp" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact name */}
            <FormField
              control={form.control}
              name="contactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Smith" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jane@acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+1 555 000 0000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Website */}
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder="https://acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>
        </div>

        {/* ── Section: Pipeline ───────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Pipeline
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      {CLIENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Lead source */}
            <FormField
              control={form.control}
              name="leadSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lead source</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      <option value="">— Select —</option>
                      {LEAD_SOURCE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Industry */}
            <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      <option value="">— Select —</option>
                      {INDUSTRY_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Company size */}
            <FormField
              control={form.control}
              name="companySize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company size</FormLabel>
                  <FormControl>
                    <Select {...field}>
                      <option value="">— Select —</option>
                      {COMPANY_SIZE_OPTIONS.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Project type — full width */}
            <FormField
              control={form.control}
              name="projectType"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Project type</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Web application redesign" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>
        </div>

        {/* ── Section: Dates ──────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-medium text-muted-foreground">
            Follow-up
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* Last contact date */}
            <FormField
              control={form.control}
              name="lastContactDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last contact date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Next follow-up date */}
            <FormField
              control={form.control}
              name="nextFollowupDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Next follow-up date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>
        </div>

        {/* ── Collapsible: Intelligence ────────────────────────────── */}
        <Collapsible
          title="Client intelligence"
          description="Pain points, requirements, and opportunity notes"
          defaultOpen={intelligenceHasData}
        >
          <div className="flex flex-col gap-4">

            {/* Pain points */}
            <FormField
              control={form.control}
              name="painPoints"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pain points</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What problems is this client trying to solve?"
                      className="min-h-[96px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Requirements */}
            <FormField
              control={form.control}
              name="requirements"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requirements</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Technical or business requirements"
                      className="min-h-[96px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Opportunity notes */}
            <FormField
              control={form.control}
              name="opportunityNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Opportunity notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Budget signals, decision timeline, competitive context…"
                      className="min-h-[96px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>
        </Collapsible>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" />}
            {isEdit ? 'Save changes' : 'Create client'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
