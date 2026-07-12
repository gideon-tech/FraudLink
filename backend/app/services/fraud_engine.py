from dataclasses import dataclass
from decimal import Decimal


@dataclass
class RiskResult:
    score: int
    level: str
    indicators: list[str]
    breakdown: list[dict]
    recommended_action: str


def risk_level(score: int) -> str:
    return "CRITICAL" if score >= 80 else "HIGH" if score >= 60 else "MEDIUM" if score >= 30 else "LOW"


def analyse_relationship(transaction_count: int, total_value: Decimal, rapid_cashout: bool, previous_alert: bool = False, high_value_threshold: int = 2_000_000) -> RiskResult:
    # Demonstration rules only; these weights are not official Bank of Uganda standards.
    rules = [("Direct relationship to confirmed fraud", 30, "LINKED_TO_CONFIRMED_FRAUD")]
    if transaction_count >= 3:
        rules.append(("Three or more related transfers within 20 minutes", 20, "RAPID_TRANSFER_PATTERN"))
    if rapid_cashout:
        rules.append(("More than 70% of linked funds cashed out within 30 minutes", 25, "RAPID_CASHOUT"))
    if previous_alert:
        rules.append(("Previous active alert", 15, "PREVIOUS_ALERT"))
    if total_value >= high_value_threshold:
        rules.append(("High-value linked activity", 20, "HIGH_VALUE_TRANSACTION"))
    score = min(100, sum(points for _, points, _ in rules))
    return RiskResult(score, risk_level(score), [code for _, _, code in rules], [{"rule": name, "score": points} for name, points, _ in rules], "INVESTIGATE_AND_CONSIDER_RESTRICTION" if score >= 60 else "ENHANCED_MONITORING")

