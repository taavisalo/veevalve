import type { AppLocale } from '@veevalve/core/client';

const TERVISEAMET_DATA_URL = 'https://vtiav.sm.ee/index.php/?active_tab_id=A';

interface AboutPanelProps {
  locale: AppLocale;
}

export const AboutPanel = ({ locale }: AboutPanelProps) => {
  return (
    <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/85 p-4 text-sm text-slate-700">
      <p className="font-semibold text-ink">
        {locale === 'et' ? 'Abi: andmeallikas ja uuendused' : 'Help: data source and updates'}
      </p>
      <p className="mt-1">
        {locale === 'et'
          ? (
              <>
                VeeValve kasutab Terviseameti avalikke XML-andmeid (
                <a
                  href={TERVISEAMET_DATA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline decoration-dotted underline-offset-2"
                >
                  vtiav.sm.ee
                </a>
                ). Kuvatakse viimased teadaolevad tulemused.
              </>
            )
          : (
              <>
                VeeValve uses public XML feeds by the Estonian Health Board (
                <a
                  href={TERVISEAMET_DATA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent underline decoration-dotted underline-offset-2"
                >
                  vtiav.sm.ee
                </a>
                ). The app shows the latest known sample status.
              </>
            )}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
        {locale === 'et' ? (
          <>
            <li>Ujulate ja basseinide allikad: `ujulad.xml`, `basseinid.xml`, `basseini_veeproovid_{'{year}'}.xml`.</li>
            <li>Supluskohtade allikad: `supluskohad.xml`, `supluskoha_veeproovid_{'{year}'}.xml`.</li>
            <li>Automaatne sünkroon käivitub iga tunni 15. minutil.</li>
            <li>Muutuseid kontrollitakse `ETag`/`Last-Modified` päistega ja sisuräsi abil.</li>
            <li>Asukohafaile kontrollitakse umbes kord ööpäevas; proovifaile sagedamini (basseinid ~2 h, rannad hooajal ~2 h, väljaspool hooaega ~24 h).</li>
          </>
        ) : (
          <>
            <li>Pool sources: `ujulad.xml`, `basseinid.xml`, `basseini_veeproovid_{'{year}'}.xml`.</li>
            <li>Beach sources: `supluskohad.xml`, `supluskoha_veeproovid_{'{year}'}.xml`.</li>
            <li>Automatic sync runs every hour at minute 15.</li>
            <li>Changes are detected via `ETag`/`Last-Modified` headers and content hash checks.</li>
            <li>Location feeds are checked about once per day; sample feeds more often (pools ~2h, beaches in season ~2h, off-season ~24h).</li>
          </>
        )}
      </ul>

      <p className="mt-3 font-semibold text-ink">
        {locale === 'et' ? 'Mida tähendavad staatused?' : 'What do statuses mean?'}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
        {locale === 'et' ? (
          <>
            <li>`Hea`: viimane proov vastab nõuetele.</li>
            <li>`Halb`: viimane proov ei vasta nõuetele.</li>
            <li>`Teadmata`: värske hinnang puudub või staatust ei saanud määrata.</li>
          </>
        ) : (
          <>
            <li>`Good`: the latest sample meets requirements.</li>
            <li>`Bad`: the latest sample does not meet requirements.</li>
            <li>`Unknown`: no recent rating is available, or a status could not be determined.</li>
          </>
        )}
      </ul>

      <p className="mt-3 font-semibold text-ink">
        {locale === 'et'
          ? 'Kuidas brauseri tõuketeavitused töötavad?'
          : 'How do browser push notifications work?'}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
        {locale === 'et' ? (
          <>
            <li>Teavitused on valikulised: esmalt lisa koht lemmikutesse, siis lülita teavitused sisse.</li>
            <li>Teavitusi saadetakse ainult lemmikutes olevatele kohtadele.</li>
            <li>Märguanne tuleb staatuse muutuse korral (`Hea` ↔ `Halb`), mitte iga uuenduse peale.</li>
            <li>Teavitused töötavad ka siis, kui leht on suletud (service workeri kaudu).</li>
            <li>Kui teavitused on blokeeritud, ava need brauseri saidi seadetes uuesti.</li>
          </>
        ) : (
          <>
            <li>Push alerts are opt-in: add a place to favorites first, then enable alerts.</li>
            <li>Notifications are sent only for favorited places.</li>
            <li>An alert is sent on status transition (`Good` ↔ `Bad`), not on every sync run.</li>
            <li>Alerts can be delivered even when the page is closed (via service worker).</li>
            <li>If notifications are blocked, re-enable them in browser site settings.</li>
          </>
        )}
      </ul>
    </div>
  );
};
