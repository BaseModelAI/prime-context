#!/usr/bin/env python3.12
"""Direct semantic judge for School Meal Allergen and Stock Plan."""
from __future__ import annotations

import argparse
import csv
import json
import shutil
import subprocess
import tempfile
from decimal import Decimal, InvalidOperation
from pathlib import Path

TASK = Path(__file__).resolve().parent
PYTHON = "/usr/bin/python3.12"

ELIGIBILITY_COLUMNS = [
    "date", "meal", "option_id", "student_id", "eligible", "allergens"
]
SAFE_COLUMNS = ["date", "meal", "student_id", "option_id"]
PURCHASE_COLUMNS = [
    "ingredient_id", "required_g", "stock_g", "shortfall_g", "pack_size_g",
    "packs_to_buy", "purchase_g",
]
ERROR_COLUMNS = ["date", "meal", "option_id", "recipe_id", "error"]
IMPACT_COLUMNS = [
    "date", "meal", "option_id", "student_id", "before_eligible",
    "after_eligible", "before_allergens", "after_allergens",
]


def copy_stage(stage: Path, workspace: Path, fixture: str) -> None:
    with tempfile.TemporaryDirectory(prefix="meal-stage-") as holder:
        payload = Path(holder)
        generated = subprocess.run(
            [PYTHON, "-E", "-S", str(stage / "_generate.py"), "--output", str(payload), "--fixture", fixture],
            cwd=stage, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=30,
        )
        if generated.returncode:
            raise RuntimeError("stage fixture generation failed")
        for source in payload.rglob("*"):
            if source.is_file():
                target = workspace / source.relative_to(payload)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)


def run_fixture(candidate: Path, fixture: str) -> tuple[Path, tempfile.TemporaryDirectory, str]:
    holder = tempfile.TemporaryDirectory(prefix=f"meal-plan-{fixture}-")
    workspace = Path(holder.name)
    seeded = subprocess.run(
        [PYTHON, "-E", "-S", str(TASK / "seed.py"), "--workspace", str(workspace), "--fixture", fixture],
        text=True,
        capture_output=True,
        timeout=30,
    )
    if seeded.returncode:
        return workspace, holder, "fixture setup failed"

    solution = candidate / "solution"
    if not solution.is_dir():
        return workspace, holder, "solution/ is missing"
    shutil.copytree(solution, workspace / "solution", dirs_exist_ok=True)

    try:
        copy_stage(TASK / "stages" / "substitutions", workspace, fixture)
    except (OSError, subprocess.SubprocessError, RuntimeError):
        return workspace, holder, "stage fixture setup failed"

    try:
        with tempfile.TemporaryFile() as stdout, tempfile.TemporaryFile() as stderr:
            completed = subprocess.run(
                [PYTHON, "-E", "-S", "-m", "solution.meal_plan", "inputs", "--output", "output"],
                cwd=workspace, stdout=stdout, stderr=stderr, timeout=60,
            )
            stderr.seek(0)
            detail = stderr.read(8000).decode("utf-8", "replace")
    except subprocess.TimeoutExpired:
        return workspace, holder, "command timed out"
    error = "" if completed.returncode == 0 else f"command failed: {detail[-300:]}"
    return workspace, holder, error


def read_csv_report(path: Path, columns: list[str]) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != columns:
            raise ValueError(f"{path.name} has wrong columns")
        rows = list(reader)
    if any(None in row or any(value is None for value in row.values()) for row in rows):
        raise ValueError(f"{path.name} has malformed rows")
    return rows


def decimal(value: str) -> Decimal:
    try:
        number = Decimal(value)
    except InvalidOperation as exc:
        raise ValueError(f"invalid decimal {value!r}") from exc
    if not number.is_finite():
        raise ValueError(f"non-finite decimal {value!r}")
    return number


def read_outputs(workspace: Path) -> dict[str, list[dict[str, str]]]:
    output = workspace / "output"
    return {
        "eligibility": read_csv_report(output / "eligibility.csv", ELIGIBILITY_COLUMNS),
        "safe": read_csv_report(output / "safe_options.csv", SAFE_COLUMNS),
        "purchase": read_csv_report(output / "purchase_list.csv", PURCHASE_COLUMNS),
        "errors": read_csv_report(output / "errors.csv", ERROR_COLUMNS),
        "impacts": read_csv_report(output / "substitution_impacts.csv", IMPACT_COLUMNS),
    }


def expected_main_eligibility() -> dict[tuple[str, str, str, str], tuple[str, str]]:
    option_allergens = {
        ("2026-09-01", "lunch", "A"): "milk;peanut;wheat",
        ("2026-09-01", "lunch", "B"): "peanut",
        ("2026-09-02", "lunch", "A"): "peanut;soy;tree_nut;wheat",
        ("2026-09-02", "lunch", "B"): "peanut;wheat",
    }
    restrictions = {
        "S001": {"milk"},
        "S002": {"wheat"},
        "S003": {"peanut"},
        "S004": {"tree_nut"},
        "S005": set(),
        "S006": {"soy"},
    }
    expected: dict[tuple[str, str, str, str], tuple[str, str]] = {}
    for option, allergen_text in option_allergens.items():
        allergens = set(allergen_text.split(";")) if allergen_text else set()
        for student_id, restricted in restrictions.items():
            eligible = "true" if allergens.isdisjoint(restricted) else "false"
            expected[(*option, student_id)] = (eligible, allergen_text)
    return expected


MAIN_REQUIRED = {
    "almond_flakes": Decimal("60"),
    "beans": Decimal("640"),
    "cheese": Decimal("300"),
    "flour": Decimal("2000"),
    "olive_oil": Decimal("58.75"),
    "rice": Decimal("800"),
    "soy_cream": Decimal("120"),
    "spice": Decimal("27.75"),
    "tomato": Decimal("940"),
}

MAIN_PURCHASE = {
    "almond_flakes": ("60", "0", "60", "100", 1, "100"),
    "beans": ("640", "100", "540", "400", 2, "800"),
    "cheese": ("300", "40", "260", "200", 2, "400"),
    "flour": ("2000", "500", "1500", "1000", 2, "2000"),
    "olive_oil": ("58.75", "50", "8.75", "250", 1, "250"),
    "rice": ("800", "300", "500", "500", 1, "500"),
    "soy_cream": ("120", "0", "120", "250", 1, "250"),
    "spice": ("27.75", "5", "22.75", "25", 1, "25"),
    "tomato": ("940", "100", "840", "500", 2, "1000"),
}


def main_checks(workspace: Path) -> tuple[list[bool], list[str], bool]:
    checks = [False] * 5
    notes: list[str] = []
    parsed = False
    try:
        reports = read_outputs(workspace)
        parsed = True
        eligibility = reports["eligibility"]
        safe = reports["safe"]
        purchases = reports["purchase"]
        errors = reports["errors"]
        impacts = reports["impacts"]

        purchase_by_id = {row["ingredient_id"]: row for row in purchases}
        purchase_order = [row["ingredient_id"] for row in purchases]
        if len(purchase_by_id) != len(purchases):
            raise ValueError("duplicate purchase rows")

        eligibility_by_key = {
            (row["date"], row["meal"], row["option_id"], row["student_id"]):
                (row["eligible"], row["allergens"])
            for row in eligibility
        }
        if len(eligibility_by_key) != len(eligibility):
            raise ValueError("duplicate eligibility rows")
    except Exception as exc:
        return checks, [f"outputs are missing or malformed: {exc}"], parsed

    # Nested quantities, including fractional nested recipe servings.
    try:
        actual_required = {
            ingredient_id: decimal(row["required_g"])
            for ingredient_id, row in purchase_by_id.items()
        }
        checks[0] = actual_required == MAIN_REQUIRED and purchase_order == sorted(MAIN_REQUIRED)
    except ValueError:
        checks[0] = False

    expected_eligibility = expected_main_eligibility()
    eligibility_order = list(eligibility_by_key)
    checks[1] = (
        len(eligibility) == 24
        and set(eligibility_by_key) == set(expected_eligibility)
        and all(
            eligibility_by_key[key][1] == expected_eligibility[key][1]
            for key in expected_eligibility
        )
        and eligibility_order == sorted(expected_eligibility)
    )

    expected_safe = sorted(
        (date, meal, student_id, option_id)
        for (date, meal, option_id, student_id), (eligible, _allergens)
        in expected_eligibility.items()
        if eligible == "true"
    )
    actual_safe = [
        (row["date"], row["meal"], row["student_id"], row["option_id"])
        for row in safe
    ]
    checks[2] = (
        eligibility_by_key == expected_eligibility
        and actual_safe == expected_safe
    )

    actual_purchase = {
        ingredient_id: (
            row["required_g"],
            row["stock_g"],
            row["shortfall_g"],
            row["pack_size_g"],
            row["packs_to_buy"],
            row["purchase_g"],
        )
        for ingredient_id, row in purchase_by_id.items()
    }
    expected_purchase = {
        ingredient_id: (
            required, stock, shortfall, pack, str(packs), purchase,
        )
        for ingredient_id, (required, stock, shortfall, pack, packs, purchase)
        in MAIN_PURCHASE.items()
    }
    checks[3] = actual_purchase == expected_purchase


    expected_impacts = [
        {
            "date": "2026-09-02", "meal": "lunch", "option_id": "A", "student_id": "S001",
            "before_eligible": "false", "after_eligible": "true",
            "before_allergens": "milk;peanut;wheat", "after_allergens": "peanut;soy;tree_nut;wheat",
        },
        {
            "date": "2026-09-02", "meal": "lunch", "option_id": "A", "student_id": "S004",
            "before_eligible": "true", "after_eligible": "false",
            "before_allergens": "milk;peanut;wheat", "after_allergens": "peanut;soy;tree_nut;wheat",
        },
        {
            "date": "2026-09-02", "meal": "lunch", "option_id": "A", "student_id": "S006",
            "before_eligible": "true", "after_eligible": "false",
            "before_allergens": "milk;peanut;wheat", "after_allergens": "peanut;soy;tree_nut;wheat",
        },
    ]
    checks[4] = impacts == expected_impacts and errors == []

    for number, passed in enumerate(checks, 1):
        if not passed:
            notes.append(f"main semantic check {number} failed")
    return checks, notes, parsed


EDGE_REQUIRED = {
    "beans": Decimal("640"),
    "cheese": Decimal("300"),
    "flour": Decimal("1400"),
    "olive_oil": Decimal("43.75"),
    "rice": Decimal("800"),
    "spice": Decimal("24.75"),
    "tomato": Decimal("700"),
}


def edge_check(workspace: Path) -> tuple[bool, str]:
    try:
        reports = read_outputs(workspace)
        eligibility = reports["eligibility"]
        safe = reports["safe"]
        purchases = reports["purchase"]
        errors = reports["errors"]
        impacts = reports["impacts"]

        expected_error = [{
            "date": "2026-09-02", "meal": "lunch", "option_id": "A",
            "recipe_id": "pizza", "error": "component_cycle",
        }]
        omitted_option = ("2026-09-02", "lunch", "A")
        expected_eligibility_map = {
            key: value
            for key, value in expected_main_eligibility().items()
            if key[:3] != omitted_option
        }
        expected_eligibility = [
            {
                "date": date,
                "meal": meal,
                "option_id": option_id,
                "student_id": student_id,
                "eligible": eligible,
                "allergens": allergens,
            }
            for (date, meal, option_id, student_id), (eligible, allergens)
            in sorted(expected_eligibility_map.items())
        ]
        expected_safe = [
            {
                "date": date,
                "meal": meal,
                "student_id": student_id,
                "option_id": option_id,
            }
            for (date, meal, option_id, student_id), (eligible, _allergens)
            in sorted(
                expected_eligibility_map.items(),
                key=lambda item: (item[0][0], item[0][1], item[0][3], item[0][2]),
            )
            if eligible == "true"
        ]
        purchase_order = [row["ingredient_id"] for row in purchases]
        purchase_by_id = {
            row["ingredient_id"]: decimal(row["required_g"])
            for row in purchases
        }

        passed = (
            errors == expected_error
            and impacts == []
            and eligibility == expected_eligibility
            and safe == expected_safe
            and len(purchase_by_id) == len(purchases)
            and purchase_order == sorted(EDGE_REQUIRED)
            and purchase_by_id == EDGE_REQUIRED
        )
        return passed, "" if passed else "cycle edge behavior was incorrect"
    except Exception as exc:
        return False, f"edge output missing or malformed: {exc}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True, type=Path)
    args = parser.parse_args()
    candidate = args.workspace.resolve()
    artifact = (candidate / "solution" / "meal_plan.py").is_file()

    if not artifact:
        result = {
            "status": "fail",
            "progress_level": 0,
            "main_checks_passed": 0,
            "main_checks_total": 5,
            "edge_check_passed": False,
            "notes": [],
        }
        print(json.dumps(result, sort_keys=True))
        return

    main_workspace, main_holder, main_error = run_fixture(candidate, "main")
    try:
        main_runnable = not main_error
        if main_error:
            checks, notes, parsed = [False] * 5, [main_error], False
        else:
            checks, notes, parsed = main_checks(main_workspace)
    finally:
        main_holder.cleanup()

    edge_workspace, edge_holder, edge_error = run_fixture(candidate, "edge")
    try:
        if edge_error:
            edge_passed, edge_note = False, edge_error
        else:
            edge_passed, edge_note = edge_check(edge_workspace)
    finally:
        edge_holder.cleanup()
    if edge_note:
        notes.append(edge_note)

    passed = sum(checks)
    if not main_runnable:
        level = 0
    elif not parsed:
        level = 1
    elif passed == 0:
        level = 2
    elif passed < 5:
        level = 3
    elif not edge_passed:
        level = 4
    else:
        level = 5

    result = {
        "status": "pass" if level == 5 else "fail",
        "progress_level": level,
        "main_checks_passed": passed,
        "main_checks_total": 5,
        "edge_check_passed": edge_passed,
        "notes": notes,
    }
    print(json.dumps(result, sort_keys=True))


if __name__ == "__main__":
    main()
