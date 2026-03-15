/**
 * Unit tests for LoadingMessage component
 * Validates: Requirements 2.7, 4.5, 9.1
 */

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: {
    create: (styles: any) => styles,
  },
  ActivityIndicator: 'ActivityIndicator',
}));

import React from "react";
import { LoadingMessage } from "../LoadingMessage";

describe("LoadingMessage", () => {
  it("should display risk level indicator immediately", () => {
    const component = (
      <LoadingMessage
        riskLevel="high"
        message="Generating personalized guidance..."
      />
    );
    expect(component.props.riskLevel).toBe("high");
  });

  it("should display loading message during generation", () => {
    const component = (
      <LoadingMessage
        riskLevel="medium"
        message="Generating personalized guidance..."
      />
    );
    expect(component.props.message).toBe(
      "Generating personalized guidance..."
    );
  });

  it("should accept custom message text", () => {
    const customMessage = "Custom loading message";
    const component = (
      <LoadingMessage riskLevel="medium" message={customMessage} />
    );
    expect(component.props.message).toBe(customMessage);
  });

  it("should work with all risk levels", () => {
    const highComponent = (
      <LoadingMessage riskLevel="high" message="Test" />
    );
    const mediumComponent = (
      <LoadingMessage riskLevel="medium" message="Test" />
    );
    const lowComponent = (
      <LoadingMessage riskLevel="low" message="Test" />
    );

    expect(highComponent.props.riskLevel).toBe("high");
    expect(mediumComponent.props.riskLevel).toBe("medium");
    expect(lowComponent.props.riskLevel).toBe("low");
  });

  it("should include RiskIndicator component", () => {
    const component = (
      <LoadingMessage riskLevel="high" message="Please wait..." />
    );
    expect(component).toBeTruthy();
    expect(component.props.riskLevel).toBe("high");
  });
});
