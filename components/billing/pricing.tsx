"use client"

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { ArrowLeftIcon, CheckCircle2Icon, MinusCircleIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { NumberTicker } from '@/components/ui/number-ticker'
import { cn } from '@/lib/utils'

export type PricingBillingPeriod = 'monthly' | 'yearly'

export type PricingPlan = {
  ctaDisabled?: boolean | Partial<Record<PricingBillingPeriod, boolean>>
  ctaLabel?: string | Partial<Record<PricingBillingPeriod, string>>
  description: string
  discount: string
  features: string[]
  icon: ReactNode
  isPopular?: boolean
  name: string
  onSelect?: (billingPeriod: PricingBillingPeriod) => void
  price: Record<PricingBillingPeriod, number>
  pricePrefix?: string
  target: string
}

export type Plans = PricingPlan[]

type PricingProps = {
  backHref?: string
  plans: Plans
}

function resolvePeriodValue<T>(
  value: T | Partial<Record<PricingBillingPeriod, T>> | undefined,
  billingPeriod: PricingBillingPeriod,
  fallback: T
): T {
  if (
    typeof value === 'object' &&
    value !== null &&
    billingPeriod in value
  ) {
    return (value as Partial<Record<PricingBillingPeriod, T>>)[billingPeriod] ?? fallback
  }

  return (value as T | undefined) ?? fallback
}

const Pricing = ({ backHref, plans }: PricingProps) => {
  const [billingPeriod, setBillingPeriod] = useState<PricingBillingPeriod>('yearly')
  const yearlyDiscountLabel =
    plans.find(plan => plan.discount.toLowerCase().includes('off'))?.discount ?? '20% off'

  return (
    <section className='py-8 sm:py-16 lg:py-24'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {backHref ? (
          <div className='mb-6 flex justify-start'>
            <Button asChild size='icon' variant='ghost'>
              <Link aria-label='Back to home' href={backHref}>
                <ArrowLeftIcon className='size-4' />
              </Link>
            </Button>
          </div>
        ) : null}

        <div className='mb-24 text-center'>
          <div className='mb-6'>
            <h2 className='text-foreground mb-4 text-2xl font-semibold sm:text-3xl lg:text-4xl'>
              Choose your right plan!
            </h2>
            <p className='text-muted-foreground mx-auto max-w-2xl text-xl'>
              Select from best plans, ensuring a perfect match. Need more or less? Customize your subscription for a
              seamless fit!
            </p>
          </div>

          <div className='relative flex items-center justify-center gap-2'>
            <Tabs
              value={billingPeriod === 'yearly' ? 'yearly' : 'monthly'}
              onValueChange={value => setBillingPeriod(value === 'monthly' ? 'monthly' : 'yearly')}
              className='bg-background rounded-md p-1'
            >
              <TabsList className='h-auto bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-7.5'>
                <TabsTrigger
                  value='monthly'
                  className='data-[state=active]:bg-muted data-[state=active]:text-muted dark:data-[state=active]:text-muted dark:data-[state=active]:bg-muted px-2 py-1 data-[state=active]:shadow-sm dark:data-[state=active]:border-transparent'
                >
                  <span className='text-foreground text-sm'>Monthly</span>
                </TabsTrigger>
                <TabsTrigger
                  value='yearly'
                  className='data-[state=active]:bg-muted data-[state=active]:text-muted dark:data-[state=active]:text-muted dark:data-[state=active]:bg-muted px-2 py-1 data-[state=active]:shadow-sm dark:data-[state=active]:border-transparent'
                >
                  <span className='text-foreground text-sm'>Yearly</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className='absolute top-10 left-1/2 flex translate-x-[50%] items-center gap-2'>
              <svg xmlns='http://www.w3.org/2000/svg' width='44' height='13' viewBox='0 0 44 13' fill='none'>
                <path
                  d='M43.3545 6.80707C43.8358 6.53627 44.0065 5.92654 43.7356 5.4452C43.4648 4.96387 42.8551 4.7932 42.3738 5.06401L43.3545 6.80707ZM0.838976 1.56996C0.293901 1.65889 -0.0758734 2.17286 0.0130627 2.71794L1.46238 11.6005C1.55132 12.1456 2.06529 12.5153 2.61036 12.4264C3.15544 12.3375 3.52522 11.8235 3.43628 11.2784L2.148 3.38282L10.0436 2.09454C10.5887 2.0056 10.9584 1.49163 10.8695 0.946553C10.7806 0.401476 10.2666 0.0317028 9.72151 0.12064L0.838976 1.56996ZM42.8641 5.93554L42.3738 5.06401C30.515 11.736 21.3317 11.567 14.6639 9.46864C7.9198 7.34631 3.69905 3.26681 1.58402 1.74516L1.00001 2.55691L0.416003 3.36865C2.29076 4.71744 6.91598 9.12711 14.0635 11.3764C21.2873 13.6497 31.0411 13.7348 43.3545 6.80707L42.8641 5.93554Z'
                  fill='var(--primary)'
                  fillOpacity='0.6'
                />
              </svg>
              <Badge variant='outline' className='border-sky-600 text-sky-600'>
                {yearlyDiscountLabel}
              </Badge>
            </div>
          </div>
        </div>

        <div className='relative grid items-end gap-6 lg:grid-cols-3'>
          {plans.map((plan, index) => {
            const ctaDisabled = resolvePeriodValue<boolean>(plan.ctaDisabled, billingPeriod, false)
            const ctaLabel = resolvePeriodValue<string>(plan.ctaLabel, billingPeriod, 'Purchase Now')

            return (
              <Card
                key={index}
                className={cn('relative w-full overflow-hidden sm:max-lg:mx-auto sm:max-lg:w-lg', {
                  'border-primary border-2 shadow-lg': plan.isPopular
                })}
              >
                <CardContent className='flex flex-col gap-6'>
                  <div>
                    <div className='mb-4 flex items-center justify-between'>
                      <h3 className='text-card-foreground text-2xl font-semibold'>{plan.name}</h3>
                      <div className='bg-muted absolute -right-5 rounded-full p-10 [&>svg]:size-12 [&>svg]:shrink-0 [&>svg]:stroke-1'>
                        {plan.icon}
                      </div>
                    </div>

                    <div className='mb-2 flex gap-1'>
                      <span className='text-muted-foreground text-lg'>{plan.pricePrefix ?? '$'}</span>
                      <NumberTicker
                        value={billingPeriod === 'yearly' ? plan.price.yearly : plan.price.monthly}
                        className='text-card-foreground text-5xl font-bold'
                      />
                      <Badge className='bg-primary/10 [a&]:hover:bg-primary/5 focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40 text-primary ml-2 self-end border-none focus-visible:outline-none'>
                        {plan.discount}
                      </Badge>
                    </div>
                    <p className='text-muted-foreground mt-4'>{plan.description}</p>
                  </div>

                  <div>
                    <Button
                      disabled={ctaDisabled}
                      onClick={() => plan.onSelect?.(billingPeriod)}
                      className={cn('w-full', {
                        'bg-primary/10 text-primary hover:bg-primary/20 focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40':
                          !plan.isPopular
                      })}
                    >
                      {ctaLabel}
                    </Button>
                  </div>

                  <div className='space-y-3'>
                    <h4 className='text-card-foreground mb-5 text-lg font-semibold'>{plan.target}</h4>
                    {plan.features.map((feature, featureIndex) => {
                      const isExcluded = /\bnot included\b/i.test(feature)

                      return (
                        <div
                          key={featureIndex}
                          className={cn('flex items-center gap-3', {
                            'opacity-45': isExcluded
                          })}
                        >
                          {isExcluded ? (
                            <MinusCircleIcon className='text-muted-foreground size-5 shrink-0' />
                          ) : (
                            <CheckCircle2Icon className='text-primary size-5 shrink-0' />
                          )}
                          <span className='text-card-foreground font-medium'>{feature}</span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default Pricing
