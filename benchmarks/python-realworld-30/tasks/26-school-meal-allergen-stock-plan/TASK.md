# School Meal Allergen and Stock Plan

Build a standard-library-only command-line program:

```bash
python -m solution.meal_plan inputs --output output
```

The command must create `output/` if needed and replace its CSV reports on every run. Read and write UTF-8 CSV with a header. Sort output rows by the keys stated below. Do not use the current date.

## Initial inputs

- `ingredients.csv`: `ingredient_id,name,allergens,may_contain,stock_g,pack_size_g`. Allergen fields are semicolon-separated lower-case tags. Empty means none. `stock_g` and `pack_size_g` are decimal grams.
- `recipes.csv`: `recipe_id,name`.
- `recipe_components.csv`: `recipe_id,component_kind,component_id,quantity`. For an `ingredient`, quantity is grams per serving of the parent recipe. For a nested `recipe`, quantity is the number of child-recipe servings per parent serving.
- `menu.csv`: `date,meal,option_id,recipe_id,planned_servings`.
- `students.csv`: `student_id,name,restricted_allergens`, with semicolon-separated tags.

Resolve recipe components recursively. Multiply every component by its parent quantity and by `planned_servings`. Treat every `may_contain` tag exactly like an `allergens` tag for eligibility, including tags inherited through nested recipes. Use `decimal.Decimal` for quantities.

Create these initial reports:

1. `eligibility.csv`, columns `date,meal,option_id,student_id,eligible,allergens`. Write one row for every student and every successfully resolved menu option. `eligible` is lower-case `true` or `false`. `allergens` is the sorted semicolon-joined effective allergen set. Sort by date, meal, option ID, student ID.
2. `safe_options.csv`, columns `date,meal,student_id,option_id`. Include **every** eligible option, so a student/day with any safe choice has at least one row. Sort by date, meal, student ID, option ID.
3. `purchase_list.csv`, columns `ingredient_id,required_g,stock_g,shortfall_g,pack_size_g,packs_to_buy,purchase_g`. Aggregate resolved base ingredients over the full menu. Subtract stock once per ingredient. `shortfall_g` is `max(required_g-stock_g, 0)`. `packs_to_buy` is the non-negative whole number of packs needed, rounded upward, and `purchase_g` is that count times the pack size. Include every ingredient with positive required quantity, even if no pack is needed. Sort by ingredient ID. Format decimal gram values without unnecessary trailing zeroes.

Also write `errors.csv`, columns `date,meal,option_id,recipe_id,error`. It normally has only its header. If resolving a menu recipe encounters a component cycle, write one row with error `component_cycle`, omit that menu option from eligibility, safe choices, and purchase totals, then continue with other menu options.

## Substitution follow-up

A later stage adds `inputs/substitutions.json`. When it is absent, produce the initial reports above and make `substitution_impacts.csv` a header-only report. When it is present it contains:

- `new_ingredients`, whose fields match the ingredient CSV except that allergen fields are JSON arrays;
- `new_recipes`;
- `new_components`, whose fields match recipe components and whose quantities are JSON strings;
- `substitutions`, each with `effective_date,recipe_id,from_ingredient_id,replacement_kind,replacement_id,replacement_quantity`.

For a matching base-ingredient component directly in the named recipe on menu dates on or after `effective_date`, use the replacement component and quantity instead. A replacement recipe can itself be nested. Substitutions do not alter earlier menu dates.

Recompute every report and add `substitution_impacts.csv`, columns:
`date,meal,option_id,student_id,before_eligible,after_eligible,before_allergens,after_allergens`.
Compare the original recipe graph with the substituted graph. Include exactly the successful menu/student rows whose Boolean eligibility changed. Sort by date, meal, option ID, student ID. A cyclic substituted option is represented in `errors.csv`, not as an impact row.

## Stated edge behavior

The one hidden edge fixture makes a substitution introduce a recipe-component cycle. Detect the cycle, report the affected top-level menu recipe in `errors.csv`, omit that option from safe choices and purchase totals, and continue processing all other recipes. Do not abort the command.
