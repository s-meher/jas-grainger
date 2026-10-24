# Citation confirmation — reference [4] in pathology/anterior-mi.md

**Scope of this pass:** single-item final confirmation only, per the two
prior reviews (`review/heart-anterior-stemi-01.md`,
`review/heart-anterior-stemi-01-recheck.md`). The re-check found that
reference [4]'s bibliographic metadata (title, authors) had been
fabricated by the editor while the URL and figures were correct; the
editor has since rewritten the reference. This file independently
re-verifies the rewritten reference against the live source, since the
same person who introduced the error also fixed it.

Live source fetched: https://www.ncbi.nlm.nih.gov/books/NBK537228/
(StatPearls, "Lateral Wall Myocardial Infarction")

## Element-by-element comparison

| Element | What the live page says | What pathology/anterior-mi.md [4] says | Result |
|---|---|---|---|
| Title | *Lateral Wall Myocardial Infarction* | *Lateral Wall Myocardial Infarction* | MATCH |
| Authors (order + form) | Dipesh Ludhwani; Lovely Chhabra; Amandeep Goyal; Bryan S. Quintanilla Rodriguez; Nagendra Gupta | Ludhwani D, Chhabra L, Goyal A, Quintanilla Rodriguez BS, Gupta N | MATCH (same 5 authors, same order, correctly abbreviated to journal-style initials — "Bryan S. Quintanilla Rodriguez" → "Quintanilla Rodriguez BS" correctly keeps the two-word surname intact) |
| Last updated date | October 29, 2024 | "last updated 29 October 2024" | MATCH |
| Publisher / place | StatPearls Publishing, Treasure Island (FL) — StatPearls boilerplate | "StatPearls [Internet]. Treasure Island (FL): StatPearls Publishing" | MATCH (standard StatPearls imprint, consistent with the page) |
| URL | https://www.ncbi.nlm.nih.gov/books/NBK537228/ | https://www.ncbi.nlm.nih.gov/books/NBK537228/ | MATCH |
| Embedded verbatim quotation | "The LCx is involved in approximately 15% to 20% of all myocardial infarctions. The LAD is involved more frequently, in around 40% to 50% of myocardial infarctions, while the right coronary artery is responsible for 30% to 40%." | Same sentence, quoted identically, word for word | MATCH — exact, including punctuation and numeral formatting |

No mismatches. Every bibliographic element and the embedded quotation
are confirmed against the live NBK537228 page. The rewritten reference
[4] fully corrects the defect identified in the re-check.

## Consistency scan of the other references (not re-verifying medical content)

- **[1] Robbins & Cotran** — Kumar V, Abbas AK, Aster JC, *Robbins and
  Cotran Pathologic Basis of Disease*, 10th ed., Elsevier, 2021. This
  authorship (Kumar/Abbas/Aster) and edition/publisher/year are the
  well-established, correct bibliographic identity of that textbook's
  10th edition — nothing here reads as invented. No URL is given (it's a
  print textbook reference), which is appropriate and not itself a red
  flag. Formatting is internally consistent with how [4] cites its
  StatPearls source. No sign of the same defect class.
- **[2] StatPearls NBK562234** — Bansal K, Gore M, Afzal M, Shams P,
  Nalabothu P, *Anterior Myocardial Infarction*, StatPearls, updated 12
  Feb 2024. Prior review already independently confirmed this entry's
  authors and date against the live page, so this pass only checked
  formatting consistency with [4]'s (now-confirmed) citation style —
  same imprint boilerplate, same URL pattern, same date phrasing. No
  inconsistency found; not re-verified beyond that per the assignment.
- **[3] Engelen et al., JACC 1999** — Engelen DJ, Gorgels AP, Cheriex EC,
  et al. *J Am Coll Cardiol*. 1999;34(2):389–395. Prior review already
  confirmed this entry's citation details. Journal citation format
  (authors, year, volume, issue, pages) is standard and internally
  consistent with normal JACC citation style; nothing here resembles the
  fabricated-byline pattern found in the original [4]. Not re-verified
  beyond a formatting read, per the assignment.

No other reference in the file's Sources section shows evidence of the
same class of defect (invented title/byline attached to a real,
otherwise-correct URL).

## Note on scope

This file does not flip `review status` in pathology/anterior-mi.md —
that line still reads "draft — pending independent verification" and is
left untouched here, as instructed. The orchestrator updates
`review.status` based on this verdict.

---

VERDICT: PASS — citation confirmed, cleared for review.status: verified
