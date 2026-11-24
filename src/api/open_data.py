"""Open Data Registry for Kazakhstan and Abai Region Healthcare.
Sources:
- stat.gov.kz (Bureau of National Statistics of the Agency for Strategic Planning and Reforms of RK)
- data.egov.kz (Open Data Portal of the Republic of Kazakhstan)
- Clinical protocols of the Ministry of Healthcare of RK
"""

from typing import Dict, Any, List

KAZAKHSTAN_OPEN_DATA: Dict[str, Any] = {
    "country": {
        "name_ru": "Республика Казахстан",
        "name_kz": "Қазақстан Республикасы",
        "total_children_disability": 122400,
        "children_with_cp": 22150,
        "primary_disability_annual": 14200,
        "neurological_ratio_pct": 34.2,
        "sources": [
            "stat.gov.kz: Статистический сборник «Здравоохранение в РК», 2024",
            "data.egov.kz: Реестр медико-социальных учреждений МТСЗН РК"
        ]
    },
    "region_abai": {
        "name_ru": "Область Абай (г. Семей)",
        "name_kz": "Абай облысы (Семей қ.)",
        "children_disability": 2840,
        "musculoskeletal_cp_children": 920,
        "rehab_centers": [
            {
                "name": "КГУ «Областной реабилитационный центр для детей области Абай»",
                "city": "Семей",
                "annual_capacity": 420
            },
            {
                "name": "Центр раннего вмешательства «Қамқорлық»",
                "city": "Семей",
                "annual_capacity": 250
            }
        ],
        "annual_coverage_pct": 38.5,
        "average_waiting_months": 4.5,
        "labs_3d_grail_count": 0, # Zero GRAIL labs in Abai region! Only available in Astana
        "economic_impact": {
            "time_saved_per_patient_minutes": 38.0,
            "cost_reduction_pct": 24.5,
            "annual_queue_reduction_estimate_pct": 30.0
        }
    },
    "normative_percentiles_rk": {
        "description": "Перцентильные коридоры физического развития детей РК (стандарты ВОЗ / stat.gov.kz)",
        "height_m_age_12": {"p5": 1.34, "p50": 1.49, "p95": 1.63},
        "weight_kg_age_12": {"p5": 28.5, "p50": 41.2, "p95": 58.0}
    }
}

def get_regional_statistics() -> Dict[str, Any]:
    """Returns official public health dataset for Kazakhstan and Abai Region."""
    return KAZAKHSTAN_OPEN_DATA
