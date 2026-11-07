"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { createLeadAction, type LeadFormState } from "@/app/actions/leads";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { SunArc } from "@/components/ui/SunArc";
import { tFrom, type MessageKey } from "@/lib/i18n/make-t";
import { isPincode, looksLikeVidarbha, parseNumber, sqmToSqft, toAsciiDigits } from "@/lib/normalize";
import { prepareImage } from "@/lib/ui/image-client";

const TOTAL = 5;
const DRAFT_KEY = "solar-lead-draft-v1";
const ROOFS = ["rcc_flat", "sloped_tin", "sloped_tile", "other"] as const;
type Values = { name: string; ownerType: string; roofType: string; roofArea: string; areaUnit: "sqft" | "sqm"; bill: string; pincode: string; consent: boolean };
const EMPTY: Values = { name: "", ownerType: "", roofType: "", roofArea: "", areaUnit: "sqft", bill: "", pincode: "", consent: false };
type Errs = Partial<Record<keyof Values | "photo", MessageKey>>;

function Option({ name, value, checked, onChange, label }: { name: string; value: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className={`flex min-h-12 cursor-pointer items-center gap-3 border-b border-hairline py-3 ${checked ? "font-bold" : ""}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChange} className="h-5 w-5 accent-[var(--ink)]" />
      <span>{label}</span>
    </label>
  );
}

export function LeadForm({ messages, demo, samples }: { messages: Record<string, string>; demo: boolean; samples: { file: string; label: string }[] }) {
  const t = tFrom(messages);
  const [state, formAction, pending] = useActionState<LeadFormState, FormData>(createLeadAction, null);
  const [step, setStep] = useState(1);
  const [v, setV] = useState<Values>(EMPTY);
  const [errs, setErrs] = useState<Errs>({});
  const [sample, setSample] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [key, setKey] = useState("");
  const [online, setOnline] = useState(true);
  const [stage, setStage] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const restored = useRef(false);

  // restore draft (offline-friendly: answers survive a reload or a dropped connection).
  // This syncs React state FROM an external system (localStorage) once, after hydration.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null");
      if (d?.v) setV({ ...EMPTY, ...d.v, consent: false });
      if (d?.step) setStep(Math.min(Math.max(d.step, 1), 4));
      setKey(d?.key || crypto.randomUUID());
    } catch { setKey(crypto.randomUUID()); }
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    restored.current = true;
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!restored.current || !key) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ v: { ...v, consent: false }, step, key }));
  }, [v, step, key]);

  // staged progress text while the server uploads, reads and checks the bill
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setStage((s) => Math.min(s + 1, 2)), 1100);
    return () => { clearInterval(id); setStage(0); };
  }, [pending]);

  // server-side errors: show them and jump to the first step that has one (adjust state during render)
  const [seenState, setSeenState] = useState<LeadFormState>(null);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.errors) {
      const e = state.errors as Errs;
      setErrs(e);
      const stepOf: [keyof Errs, number][] = [["ownerType", 1], ["roofType", 1], ["roofArea", 2], ["bill", 3], ["pincode", 3], ["photo", 4], ["consent", 5]];
      const first = stepOf.find(([k]) => e[k]);
      if (first) setStep(first[1]);
    }
  }
  useEffect(() => { if (state === null && !pending) return; if (state && !state.errors && !state.server) localStorage.removeItem(DRAFT_KEY); }, [state, pending]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => { setV((o) => ({ ...o, [k]: val })); setErrs((e) => ({ ...e, [k]: undefined })); };

  function validate(s: number): Errs {
    const e: Errs = {};
    if (s === 1) { if (!v.ownerType) e.ownerType = "lead.err.required"; if (!v.roofType) e.roofType = "lead.err.required"; }
    if (s === 2) { const n = parseNumber(v.roofArea); if (n === null || n < (v.areaUnit === "sqm" ? 2 : 20)) e.roofArea = "lead.err.area"; }
    if (s === 3) { const n = parseNumber(v.bill); if (n === null || n < 1) e.bill = "lead.err.bill"; if (!isPincode(v.pincode)) e.pincode = "lead.err.pincode"; }
    if (s === 4 && !sample && !(fileRef.current?.files?.length)) e.photo = "lead.err.photo";
    if (s === 5 && !v.consent) e.consent = "lead.err.consent";
    return e;
  }
  const next = () => { const e = validate(step); setErrs(e); if (Object.keys(e).length === 0) setStep((s) => Math.min(s + 1, TOTAL)); };

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setErrs((x) => ({ ...x, photo: undefined }));
    if (!f) { setPhotoName(""); return; }
    const r = await prepareImage(f);
    if ("error" in r) { e.target.value = ""; setPhotoName(""); setErrs((x) => ({ ...x, photo: r.error === "type" ? "lead.err.photoType" : "lead.err.photoSize" })); return; }
    if (r.file !== f) { const dt = new DataTransfer(); dt.items.add(r.file); e.target.files = dt.files; }
    setPhotoName(r.file.name);
  }

  const sqftHint = v.areaUnit === "sqm" && parseNumber(v.roofArea) ? t("lead.areaSqm", { sqft: sqmToSqft(parseNumber(v.roofArea) ?? 0) }) : undefined;
  const pinSoft = isPincode(v.pincode) && !looksLikeVidarbha(toAsciiDigits(v.pincode).trim());
  const stageText = [t("lead.stage.uploading"), t("lead.stage.reading"), t("lead.stage.checking")][stage];
  const hide = (n: number) => (step === n ? undefined : true);

  return (
    <form
      action={formAction}
      noValidate
      onKeyDown={(e) => { if (e.key === "Enter" && step < TOTAL && (e.target as HTMLElement).tagName === "INPUT") { e.preventDefault(); next(); } }}
      onSubmit={(e) => {
        if (!navigator.onLine) { e.preventDefault(); setErrs({}); return; }
        const all = [1, 2, 3, 4, 5].reduce<Errs>((a, s) => ({ ...a, ...validate(s) }), {});
        if (Object.keys(all).length) { e.preventDefault(); setErrs(all); const first = [1, 2, 3, 4, 5].find((s) => Object.keys(validate(s)).length); if (first) setStep(first); }
      }}
    >
      <input type="hidden" name="idempotencyKey" value={key} />
      <input type="hidden" name="name" value={v.name} />
      <input type="hidden" name="ownerType" value={v.ownerType} />
      <input type="hidden" name="roofType" value={v.roofType} />
      <input type="hidden" name="areaUnit" value={v.areaUnit} />
      <input type="hidden" name="roofArea" value={v.roofArea} />
      <input type="hidden" name="bill" value={v.bill} />
      <input type="hidden" name="pincode" value={v.pincode} />

      <div className="mb-6">
        <SunArc progress={(step - 1) / (TOTAL - 1)} label={t("lead.step", { n: step, total: TOTAL })} className="mx-auto max-w-[260px]" />
        <p className="num mt-1 text-center text-sm text-muted" aria-live="polite">{t("lead.step", { n: step, total: TOTAL })}</p>
      </div>

      {!online ? <p role="status" className="mb-4 border-l-4 border-warn bg-surface p-3">{t("common.offline")}</p> : null}
      {state?.server ? <p role="alert" className="mb-4 border-l-4 border-warn bg-surface p-3 font-semibold">{t(state.server)}</p> : null}

      <section hidden={hide(1)} aria-labelledby="s1">
        <h1 id="s1" className="display mb-6 text-3xl">{t("lead.s1.title")}</h1>
        <Field id="nameInput" label={t("lead.name")} hint={t("lead.nameHint")}>
          <TextInput id="nameInput" name="" autoComplete="name" hint maxLength={60} value={v.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <fieldset className="mb-6">
          <legend className="mb-1 font-semibold">{t("lead.ownerType")}</legend>
          <Option name="o" value="owner" checked={v.ownerType === "owner"} onChange={() => set("ownerType", "owner")} label={t("lead.owner")} />
          <Option name="o" value="tenant" checked={v.ownerType === "tenant"} onChange={() => set("ownerType", "tenant")} label={t("lead.tenant")} />
          <p role="alert" className={errs.ownerType ? "mt-2 text-sm font-semibold text-warn" : "sr-only"}>{errs.ownerType ? t(errs.ownerType) : ""}</p>
        </fieldset>
        <fieldset className="mb-6">
          <legend className="mb-1 font-semibold">{t("lead.roofType")}</legend>
          {ROOFS.map((r) => <Option key={r} name="r" value={r} checked={v.roofType === r} onChange={() => set("roofType", r)} label={t(`roof.${r}` as MessageKey)} />)}
          <p role="alert" className={errs.roofType ? "mt-2 text-sm font-semibold text-warn" : "sr-only"}>{errs.roofType ? t(errs.roofType) : ""}</p>
        </fieldset>
      </section>

      <section hidden={hide(2)} aria-labelledby="s2">
        <h1 id="s2" className="display mb-6 text-3xl">{t("lead.s2.title")}</h1>
        <Field id="roofAreaInput" label={t("lead.area")} hint={t("lead.areaHint")} error={errs.roofArea ? t(errs.roofArea) : null}>
          <TextInput id="roofAreaInput" name="" inputMode="decimal" autoComplete="off" hint value={v.roofArea} onChange={(e) => set("roofArea", e.target.value)} error={errs.roofArea ? t(errs.roofArea) : null} />
        </Field>
        <div className="mb-2 flex gap-6" role="radiogroup" aria-label={`${t("lead.unitSqft")} / ${t("lead.unitSqm")}`}>
          {(["sqft", "sqm"] as const).map((u) => (
            <label key={u} className="flex min-h-12 items-center gap-2">
              <input type="radio" name="unit" checked={v.areaUnit === u} onChange={() => set("areaUnit", u)} className="h-5 w-5 accent-[var(--ink)]" />
              {t(u === "sqft" ? "lead.unitSqft" : "lead.unitSqm")}
            </label>
          ))}
        </div>
        {sqftHint ? <p className="num text-sm text-muted">{sqftHint}</p> : null}
      </section>

      <section hidden={hide(3)} aria-labelledby="s3">
        <h1 id="s3" className="display mb-6 text-3xl">{t("lead.s3.title")}</h1>
        <Field id="billInput" label={t("lead.bill")} hint={t("lead.billHint")} error={errs.bill ? t(errs.bill) : null}>
          <TextInput id="billInput" name="" inputMode="numeric" autoComplete="off" hint value={v.bill} onChange={(e) => set("bill", e.target.value)} error={errs.bill ? t(errs.bill) : null} />
        </Field>
        <Field id="pinInput" label={t("lead.pincode")} error={errs.pincode ? t(errs.pincode) : null}>
          <TextInput id="pinInput" name="" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={v.pincode} onChange={(e) => set("pincode", e.target.value)} error={errs.pincode ? t(errs.pincode) : null} />
        </Field>
        {pinSoft ? <p className="text-sm text-muted">{t("lead.pincodeSoft")}</p> : null}
      </section>

      <section hidden={hide(4)} aria-labelledby="s4">
        <h1 id="s4" className="display mb-6 text-3xl">{t("lead.s4.title")}</h1>
        <Field id="photo" label={t("lead.photo")} hint={t("lead.photoHint")} error={errs.photo ? t(errs.photo) : null}>
          <input ref={fileRef} id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/*" capture="environment" onChange={onPhoto}
            aria-invalid={errs.photo ? true : undefined} aria-describedby="photo-hint photo-err"
            className="block min-h-12 w-full rounded-md border border-ink/40 bg-surface p-3 text-[17px]" />
        </Field>
        <p aria-live="polite" className="num text-sm text-support">{photoName ? t("lead.photoChosen", { name: photoName }) : ""}</p>
        {demo ? (
          <div className="mt-6 border-t border-hairline pt-4">
            <label htmlFor="sample" className="mb-1 block text-sm font-semibold">{t("lead.demoSample")}</label>
            <select id="sample" name="sample" value={sample} onChange={(e) => { setSample(e.target.value); setErrs((x) => ({ ...x, photo: undefined })); }} className="block min-h-12 w-full rounded-md border border-ink/40 bg-surface px-3">
              <option value="">{t("lead.demoSampleNone")}</option>
              {samples.map((s) => <option key={s.file} value={s.file}>{s.label}</option>)}
            </select>
          </div>
        ) : null}
      </section>

      <section hidden={hide(5)} aria-labelledby="s5">
        <h1 id="s5" className="display mb-6 text-3xl">{t("lead.s5.title")}</h1>
        <p className="num mb-6 border-y border-hairline py-3 text-muted">
          {t("lead.summary", { owner: t(v.ownerType === "tenant" ? "lead.tenant" : "lead.owner"), roof: v.roofType ? t(`roof.${v.roofType}` as MessageKey) : "", area: v.areaUnit === "sqm" ? sqmToSqft(parseNumber(v.roofArea) ?? 0) : (parseNumber(v.roofArea) ?? 0), bill: parseNumber(v.bill) ?? 0, pin: v.pincode })}
        </p>
        <label className="mb-2 flex gap-3">
          <input type="checkbox" name="consent" checked={v.consent} onChange={(e) => set("consent", e.target.checked)} aria-invalid={errs.consent ? true : undefined} className="mt-1 h-6 w-6 shrink-0 accent-[var(--ink)]" />
          <span>{t("lead.consent")}</span>
        </label>
        <p role="alert" className={errs.consent ? "mb-4 text-sm font-semibold text-warn" : "sr-only"}>{errs.consent ? t(errs.consent) : ""}</p>
        <p aria-live="polite" className="mb-4 min-h-6 font-semibold">{pending ? stageText : ""}</p>
        <p className="text-sm text-muted">{t("lead.draftSaved")}</p>
      </section>

      {/* Sticky bottom action bar (Fitts): primary action is thumb-reachable and at the end (Serial Position) */}
      <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-surface">
        <div className="mx-auto flex max-w-[560px] items-center gap-3 px-4 py-3">
          {step > 1 ? <Button type="button" variant="quiet" onClick={() => setStep(step - 1)} disabled={pending}>{t("common.back")}</Button> : null}
          {step < TOTAL ? <Button type="button" onClick={next}>{t("common.continue")}</Button> : <Button type="submit" disabled={pending}>{pending ? stageText : t("lead.submit")}</Button>}
        </div>
      </div>
    </form>
  );
}
