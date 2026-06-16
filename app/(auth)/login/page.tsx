"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "../actions";
import { SubmitButton } from "@/components/forms";

export default function LoginPage() {
  const [state, action] = useActionState(login, null);
  return (
    <div className="auth-card">
      <div className="auth-brand"><span className="mark">🐓</span> Animals Deluxe</div>
      <h2>Entrar al panel</h2>
      <p className="auth-sub">Gestiona productos, pedidos y leads.</p>
      {state?.error ? <div className="auth-err">{state.error}</div> : null}
      <form action={action}>
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" required placeholder="tu@correo.com" />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" required placeholder="••••••••" />
        </div>
        <SubmitButton pendingText="Entrando…">Entrar</SubmitButton>
      </form>
      <p className="auth-alt">¿No tienes cuenta? <Link href="/signup">Crear cuenta</Link></p>
    </div>
  );
}
