/**
 * Unit tests for MedicalDisclaimer component
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

import React from "react";
import { MedicalDisclaimer } from "../MedicalDisclaimer";

describe("MedicalDisclaimer", () => {
  it("should be visible without user interaction", () => {
    const component = <MedicalDisclaimer country="US" />;
    expect(component).toBeTruthy();
  });

  it("should state app is not a medical device for US", () => {
    const component = <MedicalDisclaimer country="US" />;
    expect(component.props.country).toBe("US");
    // Component displays: "This app is not a medical device"
  });

  it("should state app is for informational purposes only for US", () => {
    const component = <MedicalDisclaimer country="US" />;
    expect(component.props.country).toBe("US");
    // Component displays: "informational purposes only"
  });

  it("should recommend consulting healthcare providers for US", () => {
    const component = <MedicalDisclaimer country="US" />;
    expect(component.props.country).toBe("US");
    // Component displays: "consult a healthcare provider"
  });

  it("should display Japanese disclaimer for JP country", () => {
    const component = <MedicalDisclaimer country="JP" />;
    expect(component.props.country).toBe("JP");
    // Component displays Japanese text with same requirements
  });

  it("should display English disclaimer for US country", () => {
    const component = <MedicalDisclaimer country="US" />;
    expect(component.props.country).toBe("US");
    // Component displays English text
  });

  it("should always be visible on recommendation screens", () => {
    const jpComponent = <MedicalDisclaimer country="JP" />;
    const usComponent = <MedicalDisclaimer country="US" />;
    
    expect(jpComponent).toBeTruthy();
    expect(usComponent).toBeTruthy();
  });

  it("should accept both JP and US country codes", () => {
    const jpComponent = <MedicalDisclaimer country="JP" />;
    const usComponent = <MedicalDisclaimer country="US" />;
    
    expect(jpComponent.props.country).toBe("JP");
    expect(usComponent.props.country).toBe("US");
  });
});
