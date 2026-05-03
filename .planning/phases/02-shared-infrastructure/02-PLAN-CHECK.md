# Phase 2 Plan Check

**Verdict:** REVISE (1 must-fix, 3 nice-to-have)

## Coverage Matrix
| Req | Plan(s) | Status |
|-----|---------|--------|
| SHARED-01 | 02-01, 02-05 | Covered (pinned-versions.json) |
| SHARED-02 | 02-02, 02-04 | Covered (top-level shared/context7-query.md) |
| SHARED-03 | 02-01 | Covered (deprecated-imports.json discrete file) |
| SHARED-04 | 02-03, 02-04, 02-05 | Covered (build.ts via tsx; .mjs deviation documented in ORCHESTRATION) |
| SHARED-05 | 02-02, 02-04 | Covered (3 prompts authored + transcluded) |

## DAG
Wave 1: 02-01 ‖ 02-02 (zero file overlap — verified)
Wave 2: 02-03 (depends Wave 1)
Wave 3: 02-04 (depends 02-03)
Wave 4: 02-05 (depends 02-04)
Asiklik, geçerli. Konflikt yok.

## CONTEXT/Decisions Compliance
- HTML marker syntax: ✓ (3 kind: shared/snippet/prompt + uniform `@endsync`)
- build.ts via tsx: ✓ (`.mjs` REQUIREMENTS uyumsuzluğu ORCHESTRATION'da açık deviation olarak belgelenmiş — kabul edilebilir)
- validate.ts extension: ✓ (yeni CI job yok)
- pinned-versions.json filename: ✓ (CONTEXT'in "versions.json" önerisi yerine REQ spec'i tercih edildi — ORCHESTRATION'da kayıtlı)
- Sepolia adresleri pin edilmiyor: ✓ (snippet'te grep guard var)

## MUST-FIX (Blocker)

**M1 [02-04 Task 2 verify komutu] — BOZUK awk script + yanlış idempotency varsayımı**
- `awk '/<!-- @sync:/{flag=1; getline; if($0 ~ /<!-- @endsync -->/) print "EMPTY"}'` — `getline` ile sadece ardışık 2 satır kontrol eder; ancak `replaceMarker` body'yi `\n${body}\n` ile sarıyor (build.ts Task 2 step-3). Yani markerlar arası DAİMA en az 2 newline + content satırları olur, ama "EMPTY" testi yanlış pozitif/negatif riski yüksek.
- Daha kritik: `tsx scripts/build.ts && tsx scripts/build.ts --check` zinciri — ilk write tüm 5 generic/*.md ve 5 SKILL.md'yi günceller; ikinci `--check` koşusu mtime farkı değil **content** karşılaştırdığı için PASS olur. OK. Ama: build.ts pipeline step-4'te generic'i SKILL.md'den (post-expansion) üretiyor; `--check` modunda SKILL.md disk'te eski markerlı haldeyse (ilk run write yapmadıysa diye), generic karşılaştırması yanlış kaynaktan yapılır. Test verify zinciri bunu ifşa etmez.
- **Fix:** verify komutunu basitleştir: `tsx scripts/build.ts && tsx scripts/build.ts --check && pnpm test && ls generic/zama-{init,contract,test,deploy,frontend}.md` ve "EMPTY body" awk testini sil — 02-03'teki vitest zaten replaceAllMarkers idempotency'sini garantiliyor. Veya `diff <(tsx scripts/build.ts --check; echo done) <(echo done)` ile exit 0 doğrula.

## NICE-TO-HAVE

**N1 [02-03 Task 2]** — `runSync` `cwd` parametresi almıyor; 02-05 Task 2 testi `process.chdir` ile çalışacak ama bu paralel test koşumunda flaky. Build.ts API'sine `cwd?: string` ekle — 5 satırlık değişiklik, 02-05 testini sağlamlaştırır.

**N2 [02-03 Task 2 step 5]** — `examples/*/package.json` yoksa "skip silently" yazıyor ama Phase 5'e kadar examples/ yok. `--check` modunda hiç sync hedefi olmadığı durum (`changed.length === 0`) için "0 sync targets" mesajı yanıltıcı; toplam beklenen sync target sayısını ayrı raporla.

**N3 [02-04 Task 1]** — Marker'ların frontmatter altına yerleştirildiğine dair otomatik kontrol yok; "1536-char cap aşılırsa fix" yazıyor ama proaktif assertion yok. `pnpm test` (Phase 1 frontmatter validator) yakalar — kabul edilebilir, ama plan 02-05'te validate.ts'in "marker frontmatter içinde değil" kontrolü eklemesi 1 satırlık düşük maliyet.

## Orphan Check
Tüm shared/* dosyalarının tüketicisi var: snippets/* ve prompts/* → 02-04 SKILL.md markerları; pinned-versions.json + deprecated-imports.json → versions.ts → build.ts; context7-query.md → her 5 SKILL.md `@sync:shared:context7-query`. Orphan yok.

## Sonuç
M1'i (verify komutu sadeleştirme) düzelt → Phase 2 hedefini karşılar. N1-N3 opsiyonel iyileştirmeler.
