"""General anatomy references for the labels declared by research datasets.

These entries are source-backed review material. The export keeps them out of
the existing `teach` field, which the board and narrator can expose to learners.
"""
import re

LIVER_ANATOMY = (
    "https://openstax.org/books/anatomy-and-physiology-2e/pages/"
    "23-6-accessory-organs-in-digestion-the-liver-pancreas-and-gallbladder"
)
TUMOR = "https://www.cancer.gov/publications/dictionaries/cancer-terms/def/tumor"
ARTERY = "https://www.cancer.gov/publications/dictionaries/cancer-terms/def/artery"
VEIN = "https://www.cancer.gov/publications/dictionaries/cancer-terms/def/vein"
LIVER_CYST = (
    "https://www.mayoclinic.org/diseases-conditions/liver-problems/"
    "expert-answers/liver-cysts/faq-20058440?p=1"
)

# Extra aliases may only refer to one present structure. Keep unqualified
# dataset labels such as "artery" and "hepatic vessels" at their stated scope.
_ENTRIES = {
    "liver": (
        "Liver", (),
        "The liver makes bile and processes nutrients carried in the blood.",
        LIVER_ANATOMY,
    ),
    "liver_tumor": (
        "Liver tumor", ("liver tumour",),
        "A tumor is an abnormal tissue growth and can be benign or malignant.",
        TUMOR,
    ),
    "liver_tumors": (
        "Liver tumors", ("liver tumours",),
        "Tumors are abnormal tissue growths and can be benign or malignant.",
        TUMOR,
    ),
    "liver_cyst": (
        "Liver cyst", (),
        "A simple liver cyst is a cavity containing fluid within the liver.",
        LIVER_CYST,
    ),
    "hepatic_vessel": (
        "Hepatic vessels", ("hepatic vessel", "liver vessels"),
        "The liver receives blood from the hepatic artery and portal vein and drains through hepatic veins.",
        LIVER_ANATOMY,
    ),
    "portal_vein": (
        "Portal vein", ("hepatic portal vein",),
        "The portal vein supplies the liver with blood carrying nutrients absorbed by the digestive tract.",
        LIVER_ANATOMY,
    ),
    "hepatic_artery": (
        "Hepatic artery", (),
        "The hepatic artery supplies the liver with oxygenated blood.",
        LIVER_ANATOMY,
    ),
    "artery": (
        "Artery", (),
        "Arteries carry blood away from the heart.",
        ARTERY,
    ),
    "hepatic_vein": (
        "Hepatic vein", ("liver vein",),
        "Hepatic veins drain blood from the liver into the inferior vena cava.",
        LIVER_ANATOMY,
    ),
    "venous_system": (
        "Venous system", ("veins",),
        "The venous system returns blood from the tissues toward the heart.",
        VEIN,
    ),
    "vena_cava": (
        "Inferior vena cava", ("ivc", "vena cava"),
        "Hepatic veins empty into the inferior vena cava.",
        LIVER_ANATOMY,
    ),
    "biliary_system": (
        "Biliary system", ("biliary tract",),
        "Bile made in the liver travels through a network of ducts.",
        LIVER_ANATOMY,
    ),
    "gallbladder": (
        "Gallbladder", ("gall bladder",),
        "The gallbladder stores bile and releases it into the biliary tract.",
        LIVER_ANATOMY,
    ),
}


def reference_for(structure_id):
    """Return (name, aliases, reference), or None for an unmapped label."""
    numbered = re.fullmatch(r"(liver_tumor|liver_cyst)_(\d+)", structure_id)
    if numbered:
        kind, number = numbered.groups()
        name, aliases, text, source = _ENTRIES[kind]
        index = int(number)
        name = f"{name} {index}"
        aliases = tuple(f"{alias} {index}" for alias in aliases)
    else:
        entry = _ENTRIES.get(structure_id)
        if entry is None:
            return None
        name, aliases, text, source = entry
    return name, aliases, {"text": text, "sources": [source], "review_status": "pending_review"}
