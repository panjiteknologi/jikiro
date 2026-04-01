"use client";

import { signIn } from "next-auth/react";
import Form from "next/form";

import { Google as GoogleIcon } from "@/public/svg/google";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Separator } from "../ui/separator";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
  googleLabel,
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  googleLabel?: string;
}) {
  const redirectTo = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/`;

  return (
    <div className="flex flex-col gap-4 mt-4">
      {googleLabel ? (
        <>
          <Button
            className="h-10 w-full rounded-lg border-border/50 bg-background text-sm text-foreground hover:bg-muted/50"
            onClick={() => signIn("google", { redirectTo })}
            type="button"
            variant="outline"
          >
            <GoogleIcon className="size-4" />
            {googleLabel}
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              or
            </span>
            <Separator className="flex-1" />
          </div>
        </>
      ) : null}

      <Form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label className="font-normal text-muted-foreground" htmlFor="email">
            Email
          </Label>
          <Input
            autoComplete="email"
            autoFocus
            className="h-10 rounded-lg border-border/50 bg-muted/50 text-sm transition-colors focus:border-foreground/20 focus:bg-muted"
            defaultValue={defaultEmail}
            id="email"
            name="email"
            placeholder="you@someo.ne"
            required
            type="email"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label
            className="font-normal text-muted-foreground"
            htmlFor="password"
          >
            Password
          </Label>
          <Input
            className="h-10 rounded-lg border-border/50 bg-muted/50 text-sm transition-colors focus:border-foreground/20 focus:bg-muted"
            id="password"
            name="password"
            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
            required
            type="password"
          />
        </div>

        {children}
      </Form>
    </div>
  );
}
