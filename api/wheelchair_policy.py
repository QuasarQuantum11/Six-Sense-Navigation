"""Unverified outdoor wheelchair route candidates; mirrors accessibility.ts."""

import ast
import re


def tag_values(value):
    if value is None:
        return []
    if isinstance(value, str) and value.startswith("["):
        try:
            value = ast.literal_eval(value)
        except (ValueError, SyntaxError):
            pass
    if isinstance(value, (list, tuple, set)):
        return [str(item).strip().lower() for item in value]
    return [str(value).strip().lower()]


def has_steps(attributes):
    return ("steps" in tag_values(attributes.get("highway"))
            or any(value in {"true", "yes", "1"} for value in tag_values(attributes.get("has_steps")))
            or any(value.isdigit() and int(value) > 0 for value in tag_values(attributes.get("step_count"))))


def rejection_reason(attributes):
    if has_steps(attributes):
        return "steps"
    if any(value in {"no", "private"} for value in tag_values(attributes.get("foot"))):
        return "foot access=no"
    if any(value in {"no", "private"} for value in tag_values(attributes.get("access"))):
        return "access restricted"
    if (any(value in {"no", "limited"} for value in tag_values(attributes.get("wheelchair")))
            or any(value in {"false", "no", "0"} for value in tag_values(attributes.get("wheelchair_accessible")))):
        return "wheelchair tag"
    explicit = any(value in {"yes", "designated"} for value in tag_values(attributes.get("wheelchair")))
    explicit |= any(value in {"true", "yes", "1"} for value in tag_values(attributes.get("wheelchair_accessible")))
    highways = tag_values(attributes.get("highway"))
    if not highways:
        return "road"
    for highway in highways:
        if highway in {"footway", "path", "pedestrian", "cycleway", "living_street"}:
            continue
        if highway == "service":
            for limit in tag_values(attributes.get("maxspeed")):
                multiplier = 1.609344 if "mph" in limit else 1
                if any(float(value) * multiplier > 20 for value in re.findall(r"\d+(?:\.\d+)?", limit)):
                    return "road"
            continue
        if highway in {"residential", "unclassified", "road"} and explicit:
            continue
        return "road"
    return None
