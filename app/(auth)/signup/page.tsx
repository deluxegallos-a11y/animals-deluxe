"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "../actions";
import { SubmitButton } from "@/components/forms";

export default function SignupPage() {
  const [state, action] = useActionState(signup, null);
  return (
    <div className="auth-card">
      <div className="auth-brand"><span className="mark">🐓</span> Animals Deluxe</div>
      <h2>Crear cuenta admin</h2>
      <p className="auth-sub">Acceso al panel de la tienda.</p>
      {state?.error ? <div className="auth-err">{state.error}</div> : null}
      <form action={action}>
        <div className="field">
          <label htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" required placeholder="tu@correo.com" />
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" required placeholder="mínimo 6 caracteres" />
        </div>
        <SubmitButton pendingText="Creando…">Crear cuenta</SubmitButton>
      </form>
      <p className="auth-alt">¿Ya tienes cuenta? <Link href="/login">Entrar</Link></p>
    </div>
  );
}
