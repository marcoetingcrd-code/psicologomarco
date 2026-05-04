export const metadata = { title: "Privacy — Atlas" };

export default function PrivacyPage() {
  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-10 text-zinc-300 leading-relaxed">
      <h1 className="text-3xl font-semibold mb-6 text-white">Informativa sulla privacy</h1>
      <p className="text-xs text-zinc-500 mb-8">Ultimo aggiornamento: {new Date().toLocaleDateString("it-IT")}</p>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Chi siamo</h2>
        <p>
          Atlas è un assistente conversazionale che usi attraverso questo sito.
          Il titolare del trattamento è Marco ETINGCRD. Puoi contattarci a{" "}
          <a href="mailto:marcoetingcrd@gmail.com" className="text-indigo-400 underline">
            marcoetingcrd@gmail.com
          </a>
          .
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Cosa raccogliamo</h2>
        <p>
          <strong>Email</strong>: per farti accedere con link (magic link). Non usiamo password.
        </p>
        <p>
          <strong>Conversazioni</strong>: i messaggi che scambi con Atlas sono salvati nel tuo
          account in forma cifrata. Solo tu (con il tuo login) puoi leggerli.
        </p>
        <p>
          <strong>Feedback</strong>: se metti 👍 o 👎 a una risposta, salviamo il voto insieme al
          riferimento al messaggio.
        </p>
        <p>
          <strong>Dati aggregati anonimi</strong> (solo con tuo consenso esplicito): conteggi per
          tema e feedback complessivi, senza mai il contenuto dei tuoi messaggi. Servono a
          migliorare la qualità delle risposte.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">A chi trasmettiamo dati</h2>
        <p>
          <strong>Google (Gemini API)</strong>: le tue domande vengono inviate a Google per
          generare la risposta. Secondo i termini di Gemini, Google può usare i dati per
          migliorare i modelli. Non condividiamo mai la tua email con Google in questo passaggio.
        </p>
        <p>
          <strong>Supabase</strong>: ospita il database e gestisce l&apos;autenticazione. I dati
          sono cifrati a riposo e in transito. Server in UE.
        </p>
        <p>
          <strong>Vercel</strong>: ospita il sito. Server in UE.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">I tuoi diritti (GDPR)</h2>
        <p>
          Hai il diritto di accedere, rettificare, cancellare e portare via i tuoi dati. Dalla
          pagina impostazioni puoi:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Scaricare tutte le tue conversazioni in JSON</li>
          <li>Cancellare definitivamente il tuo account (hard delete, non recuperabile)</li>
          <li>Revocare il consenso al contributo aggregato anonimo in qualunque momento</li>
        </ul>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Cookie</h2>
        <p>
          Usiamo solo cookie tecnici necessari a tenere la sessione (login). Nessun tracking
          pubblicitario. Nessun cookie di profilazione.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Conservazione</h2>
        <p>
          Le tue conversazioni restano finché non le elimini tu o finché non cancelli l&apos;account.
          Gli insight aggregati anonimi restano indefinitamente perché non ti identificano.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl font-medium text-white">Modifiche</h2>
        <p>
          Se cambiamo questa informativa ti avvisiamo via email almeno 30 giorni prima che entri
          in vigore.
        </p>
      </section>

      <div className="mt-10 pt-6 border-t border-zinc-800">
        <a href="/" className="text-sm text-indigo-400 hover:text-indigo-300">
          ← Torna all&apos;app
        </a>
      </div>
    </div>
  );
}
