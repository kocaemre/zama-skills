# AskUserQuestion phrasing rules

Apply these rules to **every** `AskUserQuestion` invocation in any skill, in any language the user is conversing in.

## Question text

- **Always** start the question with a Capital Letter, even after translation. If the session is in Turkish/French/etc., translate the question naturally but preserve the leading capital.
- Always end the question with `?`.
- Keep the question short — one line is ideal, never more than two.
- Phrase as a real question, not a directive ("Pick a stack" → "Which stack do you want?").

## Options

- Each option label starts with a Capital Letter (or matches the existing kebab-case identifier — `confidential-token` is fine, `Confidential-token` is wrong).
- Add a one-line "what this means" after every option. If you can't describe it in one line, drop the option.
- Mark the most common pick with a trailing **`(recommended)`** tag (or, when context-specific, **`(recommended for first-timers)`** / **`(default)`**). Saves the user from research.
- Never have more than 6 options on a single-select. Group / collapse if you do.

## Free-form text input

- Same capitalization rule on the prompt text.
- Give a one-line example after the prompt: e.g. `"Pick a kebab-case slug for the project."` → followed by `(e.g., private-payroll)`.

## Bad / good examples

| Bad | Good |
|---|---|
| `what category?` | `Which category fits your idea best?` |
| `confidential-token: tokens` | `confidential-token` — value transfer with hidden balances. **(recommended for first-timers)** |
| `give me the slug` | `Pick a kebab-case slug for the project.` *(e.g., `private-payroll`)* |
| (no description on an option) | every option has a one-liner, no exceptions |
