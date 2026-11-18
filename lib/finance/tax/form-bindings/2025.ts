import type { YearFormBindings } from "./types";

/**
 * Curated 2025 AcroForm bindings (best-effort from official blank field order /
 * layout). Re-verify after IRS/FTB republish with:
 *   npm run tax:list-fields -- --year=2025
 */
export const bindings2025: YearFormBindings = {
  year: 2025,
  notes: [
    "Field paths taken from official 2025 IRS/FTB fillable blanks.",
    "1040 spine paths verified against filled blank text positions (2025 redesign: 12e/13a on page 2).",
    "Re-run npm run tax:refresh-spine after IRS republish; unmapped lines go to unbound supplement.",
  ],
  forms: {
    "1040": {
      "identity.firstName": "topmostSubform[0].Page1[0].f1_01[0]",
      "identity.lastName": "topmostSubform[0].Page1[0].f1_02[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_03[0]",
      "identity.spouseFirstName": "topmostSubform[0].Page1[0].f1_05[0]",
      "identity.spouseLastName": "topmostSubform[0].Page1[0].f1_06[0]",
      "identity.spouseSsn": "topmostSubform[0].Page1[0].f1_07[0]",
      "identity.addressLine1":
        "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_20[0]",
      "identity.addressLine2":
        "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_21[0]",
      "identity.city":
        "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_22[0]",
      "identity.state":
        "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_23[0]",
      "identity.zip":
        "topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_24[0]",
      // Filing status is the top row (c1_1–c1_4). c1_5+ are presidential / other.
      "filingStatus.single": {
        field: "topmostSubform[0].Page1[0].c1_1[0]",
        type: "checkbox",
      },
      "filingStatus.mfj": {
        field: "topmostSubform[0].Page1[0].c1_2[0]",
        type: "checkbox",
      },
      "filingStatus.mfs": {
        field: "topmostSubform[0].Page1[0].c1_3[0]",
        type: "checkbox",
      },
      "filingStatus.hoh": {
        field: "topmostSubform[0].Page1[0].c1_4[0]",
        type: "checkbox",
      },
      // Income column mapped by page-1 Y order on the 2025 fillable blank.
      "line.1a": "topmostSubform[0].Page1[0].f1_47[0]",
      "line.1z": "topmostSubform[0].Page1[0].f1_57[0]",
      "line.2b": "topmostSubform[0].Page1[0].f1_59[0]",
      "line.3a": "topmostSubform[0].Page1[0].f1_60[0]",
      "line.3b": "topmostSubform[0].Page1[0].f1_61[0]",
      "line.7": "topmostSubform[0].Page1[0].f1_70[0]",
      // f1_71 sits between 7 and 8 (not an amount line). 2025 layout:
      "line.8": "topmostSubform[0].Page1[0].f1_72[0]",
      "line.9": "topmostSubform[0].Page1[0].f1_73[0]",
      "line.10": "topmostSubform[0].Page1[0].f1_74[0]",
      "line.11": "topmostSubform[0].Page1[0].f1_75[0]",
      // Page 2 (2025 renumbered): 12e std ded, 13a QBI, 15 TI, 16 tax
      "line.12": "topmostSubform[0].Page2[0].f2_02[0]",
      "line.13": "topmostSubform[0].Page2[0].f2_03[0]",
      "line.15": "topmostSubform[0].Page2[0].f2_06[0]",
      "line.16": "topmostSubform[0].Page2[0].f2_07[0]",
      "line.23": "topmostSubform[0].Page2[0].f2_15[0]",
      "line.24": "topmostSubform[0].Page2[0].f2_16[0]",
      "line.25d": "topmostSubform[0].Page2[0].f2_21[0]",
      "line.26": "topmostSubform[0].Page2[0].f2_23[0]",
      "line.33": "topmostSubform[0].Page2[0].f2_31[0]",
      "line.34": "topmostSubform[0].Page2[0].f2_34[0]",
      "line.37": "topmostSubform[0].Page2[0].f2_35[0]",
    },
    "Schedule 1": {
      "identity.firstName": "topmostSubform[0].Page1[0].f1_01[0]",
      "identity.lastName": "topmostSubform[0].Page1[0].f1_02[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_03[0]",
      // f1_06 is a description field; line 3 amount is f1_07
      "line.3": "topmostSubform[0].Page1[0].f1_07[0]",
      "line.5": "topmostSubform[0].Page1[0].f1_09[0]",
      // 5k is workpaper-only (K-1 detail); no dedicated AcroForm box
      "line.10": "topmostSubform[0].Page1[0].f1_38[0]",
      "line.15": "topmostSubform[0].Page2[0].f2_05[0]",
      "line.16": "topmostSubform[0].Page2[0].f2_06[0]",
      "line.17": "topmostSubform[0].Page2[0].f2_07[0]",
      "line.26": "topmostSubform[0].Page2[0].f2_30[0]",
    },
    "Schedule 2": {
      "identity.firstName": "form1[0].Page1[0].f1_01[0]",
      "identity.ssn": "form1[0].Page1[0].f1_02[0]",
      "line.4": "form1[0].Page1[0].Line4_ReadOrder[0].f1_14[0]",
      "line.11": "form1[0].Page2[0].f2_08[0]",
      "line.12": "form1[0].Page2[0].f2_09[0]",
    },
    "Schedule B": {
      "identity.firstName": "topmostSubform[0].Page1[0].f1_1[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_2[0]",
      "line.2": "topmostSubform[0].Page1[0].f1_19[0]",
      "line.6": "topmostSubform[0].Page1[0].f1_39[0]",
    },
    "Schedule C": {
      // Field paths for the 2025 fillable blank (irs-prior/f1040sc--2025.pdf).
      "identity.legalName": "topmostSubform[0].Page1[0].f1_1[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_2[0]",
      "identity.occupation": "topmostSubform[0].Page1[0].f1_3[0]",
      "line.1": "topmostSubform[0].Page1[0].f1_10[0]",
      "line.7": "topmostSubform[0].Page1[0].f1_16[0]",
      "line.28": "topmostSubform[0].Page1[0].f1_41[0]",
      "line.29": "topmostSubform[0].Page1[0].f1_42[0]",
      "line.30":
        "topmostSubform[0].Page1[0].Line30_ReadOrder[0].f1_44[0]",
      "line.31": "topmostSubform[0].Page1[0].f1_45[0]",
    },
    "Schedule D": {
      "identity.firstName": "topmostSubform[0].Page1[0].f1_1[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_2[0]",
      "line.7": "topmostSubform[0].Page1[0].f1_19[0]",
      "line.15": "topmostSubform[0].Page1[0].f1_39[0]",
    },
    "Schedule SE": {
      "identity.firstName": "topmostSubform[0].Page1[0].f1_1[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_2[0]",
      "line.4a": "topmostSubform[0].Page1[0].f1_6[0]",
      "line.12": "topmostSubform[0].Page1[0].f1_16[0]",
      "line.13": "topmostSubform[0].Page1[0].f1_17[0]",
    },
    "Form 8995": {
      "identity.firstName": "topmostSubform[0].Page1[0].f1_1[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_2[0]",
      "line.15": "topmostSubform[0].Page1[0].f1_20[0]",
    },
    "8959": {
      "identity.firstName": "topmostSubform[0].Page1[0].f1_01[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_02[0]",
      "line.18": "topmostSubform[0].Page1[0].f1_30[0]",
    },
    "8960": {
      "identity.firstName": "topmostSubform[0].Page1[0].f1_01[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_02[0]",
      "line.17": "topmostSubform[0].Page1[0].f1_30[0]",
    },
    "Form 8949": {
      "identity.firstName": "topmostSubform[0].Page1[0].f1_01[0]",
      "identity.ssn": "topmostSubform[0].Page1[0].f1_02[0]",
      // Summary on first data row: description / proceeds / basis columns
      "line.Part I totals":
        "topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row1[0].f1_06[0]",
      "line.Part I basis":
        "topmostSubform[0].Page1[0].Table_Line1_Part1[0].Row1[0].f1_07[0]",
      "line.Part II totals":
        "topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row1[0].f2_06[0]",
      "line.Part II basis":
        "topmostSubform[0].Page2[0].Table_Line1_Part2[0].Row1[0].f2_07[0]",
    },
    "540": {
      // FTB uses opaque numeric field ids — identity + key totals
      "identity.legalName": "540_form_1041",
      "identity.ssn": "540_form_1039",
      "identity.addressLine1": "540_form_1030",
      "identity.city": "540_form_1031",
      "identity.state": "540_form_1032",
      "identity.zip": "540_form_1033",
      "line.13": "540_form_1015",
      "line.18": "540_form_1013",
      "line.19": "540_form_1011",
      "line.31": "540_form_1005",
      "line.64": "540_form_1003",
      "line.71": "540_form_2007",
      "line.72": "540_form_2008",
      "line.97": "540_form_3007",
      "line.111": "540_form_3025",
    },
    "Schedule CA (540)": {
      // Note: FTB field names include spaces around the hyphen
      "identity.ssn": "540ca_form - 1002",
      "line.Part II QBI": "540ca_form - 1050",
    },
  },
};
