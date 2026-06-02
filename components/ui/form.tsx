'use client'

import * as React from 'react'
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldError,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// ── Provider ───────────────────────────────────────────────────────────────

const Form = FormProvider

// ── Field context ──────────────────────────────────────────────────────────

type FormFieldContextValue = {
  name: string
  error: FieldError | undefined
}

const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
)

function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <Controller
      {...props}
      render={(renderProps) => (
        <FormFieldContext.Provider
          value={{ name: props.name, error: renderProps.fieldState.error }}
        >
          {props.render(renderProps)}
        </FormFieldContext.Provider>
      )}
    />
  )
}

// ── Item context ───────────────────────────────────────────────────────────

type FormItemContextValue = { id: string }

const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
)

function FormItem({ className, ...props }: React.ComponentProps<'div'>) {
  const id = React.useId()
  return (
    <FormItemContext.Provider value={{ id }}>
      <div className={cn('flex flex-col gap-1.5', className)} {...props} />
    </FormItemContext.Provider>
  )
}

// ── useFormField ───────────────────────────────────────────────────────────

function useFormField() {
  const fieldCtx = React.useContext(FormFieldContext)
  const { id } = React.useContext(FormItemContext)
  const { formState } = useFormContext()

  if (!fieldCtx.name) {
    throw new Error('useFormField must be used within <FormField>')
  }

  return {
    id,
    name: fieldCtx.name,
    formItemId: `${id}-form-item`,
    formMessageId: `${id}-form-message`,
    error: fieldCtx.error,
    isDirty: formState.dirtyFields[fieldCtx.name as keyof typeof formState.dirtyFields],
  }
}

// ── Label ──────────────────────────────────────────────────────────────────

function FormLabel({ className, ...props }: React.ComponentProps<'label'>) {
  const { error, formItemId } = useFormField()
  return (
    <Label
      htmlFor={formItemId}
      className={cn(error && 'text-destructive', className)}
      {...props}
    />
  )
}

// ── Control ────────────────────────────────────────────────────────────────
// Clones the single child element to inject `id` and `aria-invalid`.

function FormControl({
  children,
}: {
  children: React.ReactElement<React.HTMLAttributes<HTMLElement>>
}) {
  const { formItemId, formMessageId, error } = useFormField()
  return React.cloneElement(children, {
    id: formItemId,
    'aria-invalid': (!!error || undefined) as boolean | undefined,
    'aria-describedby': error ? formMessageId : undefined,
  })
}

// ── Message ────────────────────────────────────────────────────────────────

function FormMessage({ className, children, ...props }: React.ComponentProps<'p'>) {
  const { error, formMessageId } = useFormField()
  const body = error?.message ?? children
  if (!body) return null
  return (
    <p
      id={formMessageId}
      role="alert"
      className={cn('text-xs text-destructive', className)}
      {...props}
    >
      {body}
    </p>
  )
}

export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useFormField,
}
