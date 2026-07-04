"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Github, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Min 8 characters"),
});
const registerSchema = loginSchema.extend({
  name: z.string().min(1, "Name required").max(60),
});

type LoginValues = z.infer<typeof loginSchema>;
type RegisterValues = z.infer<typeof registerSchema>;

export function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");

  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { email: "", password: "", name: "" } });

  const onLogin = loginForm.handleSubmit(async (v) => {
    try {
      await login(v.email, v.password);
      toast.success("Welcome back!");
    } catch (e) {
      toast.error((e as Error).message || "Login failed");
    }
  });

  const onRegister = registerForm.handleSubmit(async (v) => {
    try {
      await register(v.email, v.password, v.name);
      toast.success("Account created!");
    } catch (e) {
      toast.error((e as Error).message || "Registration failed");
    }
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-foreground text-background flex items-center justify-center font-semibold text-sm">LC</div>
          <span className="font-medium tracking-tight">LeetCode Tracker</span>
        </div>
        <a
          href="https://github.com/AkshatSinghNayal?tab=repositories"
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="GitHub"
        >
          <Github className="w-5 h-5" />
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "login" ? "Sign in" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {mode === "login"
                ? "Pick up where you left off. Track DP, arrays, graphs — your way."
                : "Free account. Upload CSVs. Track solved progress per sheet."}
            </p>
          </div>

          {mode === "login" ? (
            <form onSubmit={onLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">Email</Label>
                <Input id="login-email" type="email" autoComplete="email" {...loginForm.register("email")} />
                {loginForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-pw">Password</Label>
                <Input id="login-pw" type="password" autoComplete="current-password" {...loginForm.register("password")} />
                {loginForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={loginForm.formState.isSubmitting}>
                {loginForm.formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign in <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </form>
          ) : (
            <form onSubmit={onRegister} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reg-name">Name</Label>
                <Input id="reg-name" autoComplete="name" {...registerForm.register("name")} />
                {registerForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-email">Email</Label>
                <Input id="reg-email" type="email" autoComplete="email" {...registerForm.register("email")} />
                {registerForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-pw">Password</Label>
                <Input id="reg-pw" type="password" autoComplete="new-password" {...registerForm.register("password")} />
                {registerForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{registerForm.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={registerForm.formState.isSubmitting}>
                {registerForm.formState.isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create account <ArrowRight className="w-4 h-4" /></>}
              </Button>
            </form>
          )}

          <div className="text-center text-sm text-muted-foreground">
            {mode === "login" ? (
              <>Don&apos;t have an account?{" "}
                <button type="button" className="text-foreground underline-offset-4 hover:underline" onClick={() => setMode("register")}>Sign up</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button type="button" className="text-foreground underline-offset-4 hover:underline" onClick={() => setMode("login")}>Sign in</button>
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-border text-xs text-muted-foreground text-center">
        Multi-user · Server-side persistence · JWT auth
      </footer>
    </div>
  );
}
