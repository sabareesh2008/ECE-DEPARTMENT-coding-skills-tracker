from __future__ import annotations

import mimetypes
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests


REQUEST_TIMEOUT = 60
MAX_TEMPLATE_TEXT = 900


@dataclass(frozen=True)
class WhatsAppConfig:
    access_token: str
    phone_number_id: str
    api_version: str
    template_language: str
    daily_template: str
    weekly_template: str
    section_numbers: dict[str, str]
    hod_number: str


def normalize_phone(value: str) -> str:
    """Return an E.164-style digits-only recipient number for Meta."""
    digits = "".join(ch for ch in str(value or "") if ch.isdigit())

    if not digits:
        raise ValueError("WhatsApp recipient number is empty.")

    return digits


def _graph_url(config: WhatsAppConfig, path: str) -> str:
    return (
        f"https://graph.facebook.com/{config.api_version}/"
        f"{config.phone_number_id}/{path.lstrip('/')}"
    )


def _headers(config: WhatsAppConfig) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {config.access_token}",
    }


def upload_pdf(config: WhatsAppConfig, pdf_path: Path) -> str:
    """Upload the PDF to WhatsApp and return the temporary media ID."""

    if not pdf_path.exists():
        raise FileNotFoundError(
            f"WhatsApp PDF attachment not found: {pdf_path}"
        )

    mime_type = (
        mimetypes.guess_type(pdf_path.name)[0]
        or "application/pdf"
    )

    with pdf_path.open("rb") as file_handle:
        response = requests.post(
            _graph_url(config, "media"),
            headers=_headers(config),
            data={
                "messaging_product": "whatsapp",
            },
            files={
                "file": (
                    pdf_path.name,
                    file_handle,
                    mime_type,
                )
            },
            timeout=REQUEST_TIMEOUT,
        )

    if not response.ok:
        raise RuntimeError(
            f"WhatsApp media upload failed ({response.status_code}): "
            f"{response.text}"
        )

    payload = response.json()

    media_id = str(payload.get("id") or "").strip()

    if not media_id:
        raise RuntimeError(
            f"WhatsApp media upload returned no media ID: {payload}"
        )

    return media_id


def _fit_inactive_names(names: list[str]) -> str:
    """Keep inactive student names within WhatsApp template limits."""

    cleaned: list[str] = []
    seen: set[str] = set()

    for value in names:
        name = " ".join(
            str(value or "").split()
        ).strip()

        if not name:
            continue

        key = name.casefold()

        if key in seen:
            continue

        seen.add(key)
        cleaned.append(name)

    if not cleaned:
        return "None"

    result = ""
    remaining = 0

    for index, name in enumerate(cleaned):
        candidate = (
            name
            if not result
            else f"{result}, {name}"
        )

        if len(candidate) > MAX_TEMPLATE_TEXT:
            remaining = len(cleaned) - index
            break

        result = candidate

    if remaining:
        suffix = f" + {remaining} more"

        if len(result) + len(suffix) <= MAX_TEMPLATE_TEXT:
            result += suffix

    return result or cleaned[0][:MAX_TEMPLATE_TEXT]


def _named_text_parameter(
    parameter_name: str,
    value: str,
) -> dict[str, str]:
    """
    Build a named WhatsApp template body parameter.

    The parameter_name must exactly match the variable name
    configured inside the Meta WhatsApp template.
    """

    return {
        "type": "text",
        "parameter_name": parameter_name,
        "text": str(value),
    }


def send_template_with_pdf(
    config: WhatsAppConfig,
    recipient: str,
    template_name: str,
    template_variables: dict[str, str],
    pdf_media_id: str,
) -> str:
    """
    Send an approved WhatsApp template with the generated PDF
    as the document header.

    The template uses NAMED variables rather than numbered
    variables.
    """

    body_parameters = [
        _named_text_parameter(
            parameter_name,
            value,
        )
        for parameter_name, value in template_variables.items()
    ]

    payload: dict[str, Any] = {
        "messaging_product": "whatsapp",
        "to": normalize_phone(recipient),
        "type": "template",
        "template": {
            "name": template_name,
            "language": {
                "code": config.template_language,
            },
            "components": [
                {
                    "type": "header",
                    "parameters": [
                        {
                            "type": "document",
                            "document": {
                                "id": pdf_media_id,
                            },
                        }
                    ],
                },
                {
                    "type": "body",
                    "parameters": body_parameters,
                },
            ],
        },
    }

    response = requests.post(
        _graph_url(config, "messages"),
        headers={
            **_headers(config),
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=REQUEST_TIMEOUT,
    )

    if not response.ok:
        raise RuntimeError(
            f"WhatsApp template send failed ({response.status_code}): "
            f"{response.text}"
        )

    data = response.json()

    messages = data.get("messages") or []

    message_id = (
        str(messages[0].get("id"))
        if messages
        else ""
    )

    if not message_id:
        raise RuntimeError(
            f"WhatsApp API returned no message ID: {data}"
        )

    return message_id


def send_whatsapp_report(
    config: WhatsAppConfig,
    recipient: str,
    *,
    mode: str,
    scope_label: str,
    period_label: str,
    total_students: int,
    active_students: int,
    inactive_students_count: int,
    inactive_rows: list[dict[str, Any]],
    pdf_path: Path,
) -> str:
    """
    Send one section/overall faculty report with its matching PDF.
    """

    if not config.access_token:
        raise RuntimeError(
            "WHATSAPP_ACCESS_TOKEN is not configured."
        )

    if not config.phone_number_id:
        raise RuntimeError(
            "WHATSAPP_PHONE_NUMBER_ID is not configured."
        )

    mode_key = mode.strip().lower()

    if mode_key not in {"daily", "weekly"}:
        raise ValueError(
            f"Unsupported WhatsApp report mode: {mode}"
        )

    template_name = (
        config.daily_template
        if mode_key == "daily"
        else config.weekly_template
    )

    if not template_name:
        raise RuntimeError(
            f"No WhatsApp template configured for "
            f"{mode_key} reports."
        )

    inactive_names = _fit_inactive_names(
        [
            str(row.get("name", "")).strip()
            for row in inactive_rows
        ]
    )

    media_id = upload_pdf(
        config,
        pdf_path,
    )

    # IMPORTANT:
    # These names MUST exactly match the named variables
    # configured in the Meta WhatsApp template.
    template_variables = {
        "report_type": (
            "Daily"
            if mode_key == "daily"
            else "Weekly"
        ),
        "scope": scope_label,
        "period": period_label,
        "total_students": str(total_students),
        "active_students": str(active_students),
        "inactive_count": str(
            inactive_students_count
        ),
        "inactive_names": inactive_names,
    }

    return send_template_with_pdf(
        config,
        recipient,
        template_name,
        template_variables,
        media_id,
    )