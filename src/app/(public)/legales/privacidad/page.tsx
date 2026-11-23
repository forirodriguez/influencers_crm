import { LEGAL_VERSION } from "../../../../lib/constants";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-sm text-muted">Borrador {LEGAL_VERSION}. No es asesoramiento legal.</p>
      <h1 className="mt-3 font-display text-4xl">Privacidad</h1>
      <div className="mt-6 space-y-4 text-sm leading-6">
        <p>
          Guardamos la cuenta, el workspace, los acuerdos que cargues y, si los conectás, tokens de redes cifrados. La
          región prevista de la base es São Paulo. Hay que declararlo como transferencia internacional antes de la beta
          abierta.
        </p>
        <p>
          En México, los montos de acuerdos pueden ser datos patrimoniales y piden consentimiento expreso. El checkbox
          del registro cubre términos y privacidad en este borrador; un abogado tiene que revisar el texto final.
        </p>
        <p>Vas a poder exportar y borrar la cuenta. El borrado físico queda programado como job, todavía sin ejecutar.</p>
      </div>
    </main>
  );
}
