"""Semester 8 Assessment Engine Extension Boundary (Explicitly Not Implemented in S7)."""
from __future__ import annotations

SEMESTER_8_CAPABILITIES = (
    "zap_scanner",
    "openapi_importer",
    "schemathesis_fuzzer",
    "behavior_graph_miner",
    "business_invariant_engine",
    "report_generator",
    "ai_advisor",
)


def invoke_semester8_module(module_name: str) -> None:
    """Explicit Semester 8 extension stub — always fails closed in Semester 7."""
    raise NotImplementedError(
        f"Assessment module '{module_name}' is deferred to Semester 8 (60% milestone)."
    )
