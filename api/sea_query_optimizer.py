"""Flatten the revenue view only for compatible Sea consol reports.

The view groups shipment facts across many descriptive columns. These reports
then sum those amounts again by consol. Removing that intermediate grouping is
safe for SUM, MAX, and COUNT(DISTINCT), provided all view joins are retained and
the report does not filter individual grouped financial amounts.
"""
import re
from functools import lru_cache

SOURCE = "ChatData_ViewRevandVolume_ShipmentDate"
VIEW_DEFINITION_SQL = f"SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.{SOURCE}')) AS definition"
_REQUIRED = ("ShipmentNumber", "Company", "Branch", "BranchName", "BranchCity",
             "Revenue_USD", "Cost_USD", "Profit_USD")
_OUTER_KEYS = ("ViewClient", "ViewClient_CountryCode", "LocalClientCountryCode", "BillingClient_CountryCode")
_FINANCIAL = {"revenue_usd", "cost_usd", "profit_usd"}
_SOURCE_JOIN = re.compile(r"\bLEFT\s+(?:OUTER\s+)?JOIN\s+(?:dbo\.)?" + SOURCE + r"\s+(?:AS\s+)?vs\b", re.I)


def _without_comments(sql):
    """Remove SQL comments without treating quoted strings as comments."""
    result, i = [], 0
    while i < len(sql):
        if sql[i] in "'\"[":
            start, closing = i, "]" if sql[i] == "[" else sql[i]
            i += 1
            while i < len(sql):
                if sql[i] == closing:
                    i += 1
                    if i < len(sql) and sql[i] == closing:
                        i += 1
                        continue
                    break
                i += 1
            result.append(sql[start:i])
        elif sql.startswith("--", i):
            end = sql.find("\n", i)
            i = len(sql) if end < 0 else end
            result.append(" ")
        elif sql.startswith("/*", i):
            depth = 1
            i += 2
            while i < len(sql) and depth:
                if sql.startswith("/*", i):
                    depth += 1
                    i += 2
                elif sql.startswith("*/", i):
                    depth -= 1
                    i += 2
                else:
                    i += 1
            result.append(" ")
        else:
            result.append(sql[i])
            i += 1
    return "".join(result)


def can_optimize(sql):
    code = _without_comments(sql)
    if len(_SOURCE_JOIN.findall(code)) != 1:
        return False
    # Sector reports sum an already grouped SeaConsols CTE. Validate that inner
    # report, whose rows remain identical, rather than its later sector totals.
    cte = re.match(r"\s*WITH\s+SeaConsols\s+AS\s*\(", code, re.I)
    if cte:
        start, depth, quote, i = cte.end(), 1, None, cte.end()
        while i < len(code) and depth:
            char = code[i]
            if quote:
                if char == quote:
                    if i + 1 < len(code) and code[i + 1] == quote:
                        i += 1
                    else:
                        quote = None
            elif char in "'\"[":
                quote = "]" if char == "[" else char
            elif char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
            i += 1
        if depth:
            return False
        code = code[start:i - 1]
    if not code.lstrip().upper().startswith("SELECT"):
        return False
    if not re.search(r"\bvt\.TransportMode\s*=\s*'SEA'", code, re.I):
        return False
    if re.search(r"\b(?:OVER|COUNT_BIG|CHECKSUM_AGG|STDEV|STDEVP|VAR|VARP|APPROX_COUNT_DISTINCT)\s*\(", code, re.I):
        return False
    if re.search(r"\bvs\.\s*[\[\"]", code, re.I):
        return False
    refs = {col.lower() for col in re.findall(r"\bvs\.([a-zA-Z_][a-zA-Z_0-9]*)", code, re.I)}
    if not refs <= {col.lower() for col in _REQUIRED}:
        return False
    # Intermediate grouping changes row counts and individual amount values;
    # only additive financial measures and distinct shipment counts are safe.
    stripped = re.sub(r"\bSUM\(\s*vs\.(?:Revenue_USD|Cost_USD|Profit_USD)\s*\)", "", code, flags=re.I)
    if re.search(r"\bvs\.(?:Revenue_USD|Cost_USD|Profit_USD)\b", stripped, re.I):
        return False
    # Bare amount columns can resolve to the shipment view as well. Report
    # aliases are safe in SELECT/ORDER BY, but never use them as input amounts.
    inputs = re.split(r"\bORDER\s+BY\b", stripped, maxsplit=1, flags=re.I)[0]
    inputs = re.sub(r"\bAS\s+(?:Revenue_USD|Cost_USD|Profit_USD)\b", "", inputs, flags=re.I)
    if re.search(r"(?<![\w.])(?:Revenue_USD|Cost_USD|Profit_USD)\b", inputs, re.I):
        return False
    if any(not re.match(r"DISTINCT\b", code[match.end():], re.I)
           for match in re.finditer(r"\bCOUNT\s*\(\s*", code, re.I)):
        return False
    stripped = re.sub(r"\bMAX\(\s*vt\.(?:FCLTEU|LCLVolume)\s*\)", "", code, flags=re.I)
    if re.search(r"\bvt\.(?:FCLTEU|LCLVolume)\b", stripped, re.I):
        return False
    # Any SUM other than the known shipment amounts could count transaction
    # rows differently after flattening (for example SUM(vt.FCLTEU)).
    financial_sums = re.sub(r"\bSUM\(\s*vs\.(?:Revenue_USD|Cost_USD|Profit_USD)\s*\)", "", code, flags=re.I)
    if re.search(r"\b(?:SUM|AVG|STRING_AGG)\s*\(", financial_sums, re.I):
        return False
    return bool(re.search(r"\bGROUP\s+BY\b|\bSELECT\s+DISTINCT\b", code, re.I))


def _split_columns(select):
    """Split SELECT items, respecting function arguments and quoted commas."""
    items, start, depth, quote, i = [], 0, 0, None, 0
    while i < len(select):
        char = select[i]
        if quote:
            if char == quote:
                if i + 1 < len(select) and select[i + 1] == quote:
                    i += 1
                else:
                    quote = None
        elif char in "'\"[":
            quote = "]" if char == "[" else char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == "," and depth == 0:
            items.append(select[start:i].strip())
            start = i + 1
        i += 1
    items.append(select[start:].strip())
    return items


def _alias(item):
    match = re.search(r"\bAS\s+(\w+)\s*$", item, re.I) or re.search(r"\.([a-zA-Z_][a-zA-Z_0-9]*)\s*$", item)
    return match.group(1).lower() if match else None


@lru_cache(maxsize=4)
def compile_revenue_source(definition):
    """Compile a financial projection from a recognized current view definition.

    Fail closed on changed/unrecognized view structure. All joins, including
    outer client joins, volume grouping, and update-time cross joins, survive.
    This preserves even duplicate dimension matches and unlinked shipments.
    """
    code = _without_comments(definition).strip().rstrip(";")
    if re.search(r"\b(?:HAVING|UNION|DISTINCT|TOP|OVER|WHERE|ROLLUP|CUBE|GROUPING)\b", code, re.I):
        raise ValueError("Unrecognized revenue view filtering or aggregation")
    inner_start = re.search(r"\bFROM\s+\(\s*SELECT\s+", code, re.I)
    if not inner_start:
        raise ValueError("Revenue view has no recognized shipment grouping")
    inner_end = re.search(r"\)\s+AS\s+d\s+LEFT\s+OUTER\s+JOIN", code[inner_start.end():], re.I)
    if not inner_end:
        raise ValueError("Revenue view outer joins have changed")
    end = inner_start.end() + inner_end.start()
    inner = code[inner_start.end():end]
    source_from = re.search(r"\bFROM\s+dbo\.RevandVolFact\s+AS\s+RVF\b", inner, re.I)
    groups = list(re.finditer(r"\bGROUP\s+BY\s+RVF\.", inner, re.I))
    if not source_from or len(groups) != 1:
        raise ValueError("Revenue view fact source or grouping has changed")
    outer_select = code[code.upper().find("SELECT") + 6:inner_start.start()]
    outer_columns = {_alias(item): item for item in _split_columns(outer_select)}
    for name in _REQUIRED:
        item = outer_columns.get(name.lower(), "")
        if not re.fullmatch(r"d\." + name + r"(?:\s+AS\s+" + name + r")?", item, re.I):
            raise ValueError("Revenue view changes the report's projected values")
    columns = {_alias(item): item for item in _split_columns(inner[:source_from.start()])}
    selected = []
    for name in (*_REQUIRED, *_OUTER_KEYS):
        item = columns.get(name.lower())
        if not item:
            raise ValueError("Revenue view is missing required report keys")
        if name.lower() in _FINANCIAL:
            match = re.fullmatch(r"SUM\(\s*(RVF\.\w+)\s*\)\s+AS\s+" + name, item, re.I)
            if not match:
                raise ValueError("Revenue view contains a non-additive amount")
            item = f"{match.group(1)} AS {name}"
        elif re.search(r"\b(?:SUM|COUNT|MAX|MIN|AVG)\s*\(", item, re.I):
            raise ValueError("Revenue view keys depend on aggregation")
        selected.append(item)
    joins = inner[source_from.start():groups[0].start()].strip()
    outer_joins = code[end:]
    # A grouping left inside a nested volume subquery is deliberately retained.
    return "SELECT " + ", ".join("d." + name for name in _REQUIRED) + "\nFROM (SELECT\n" + ",\n".join(selected) + "\n" + joins + "\n" + outer_joins


def optimize_query(sql, definition):
    if not can_optimize(sql):
        return sql
    source = compile_revenue_source(definition)
    return _SOURCE_JOIN.sub(lambda _: "LEFT JOIN (" + source + ") vs", sql, count=1)
