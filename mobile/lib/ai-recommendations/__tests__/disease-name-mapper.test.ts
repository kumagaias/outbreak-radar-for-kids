/**
 * Disease Name Mapper Tests
 */

import { mapDiseaseName, requiresMedicalClearance } from '../disease-name-mapper';
import { Language } from '../types';

describe('Disease Name Mapper', () => {
  describe('mapDiseaseName', () => {
    it('should map RSV to Japanese', () => {
      expect(mapDiseaseName('RSV', Language.JAPANESE)).toBe('RSウイルス感染症');
    });

    it('should map RSV to English', () => {
      expect(mapDiseaseName('RSV', Language.ENGLISH)).toBe('RSV');
    });

    it('should map Influenza to Japanese', () => {
      expect(mapDiseaseName('Influenza', Language.JAPANESE)).toBe('インフルエンザ');
    });

    it('should map Norovirus to Japanese', () => {
      expect(mapDiseaseName('Norovirus', Language.JAPANESE)).toBe('ノロウイルス');
    });

    it('should map Hand-Foot-Mouth Disease to Japanese', () => {
      expect(mapDiseaseName('Hand-Foot-Mouth Disease', Language.JAPANESE)).toBe('手足口病');
    });

    it('should handle case-insensitive matching', () => {
      expect(mapDiseaseName('rsv', Language.JAPANESE)).toBe('RSウイルス感染症');
      expect(mapDiseaseName('INFLUENZA', Language.JAPANESE)).toBe('インフルエンザ');
    });

    it('should handle partial matching', () => {
      expect(mapDiseaseName('RSV Infection', Language.JAPANESE)).toBe('RSウイルス感染症');
      expect(mapDiseaseName('Influenza A', Language.JAPANESE)).toBe('インフルエンザ');
    });

    it('should return original name if no mapping found', () => {
      expect(mapDiseaseName('Unknown Disease', Language.JAPANESE)).toBe('Unknown Disease');
      expect(mapDiseaseName('Unknown Disease', Language.ENGLISH)).toBe('Unknown Disease');
    });

    it('should map COVID-19 correctly', () => {
      expect(mapDiseaseName('COVID-19', Language.JAPANESE)).toBe('新型コロナウイルス感染症');
      expect(mapDiseaseName('SARS-CoV-2', Language.JAPANESE)).toBe('新型コロナウイルス感染症');
    });

    it('should map Measles to Japanese', () => {
      expect(mapDiseaseName('Measles', Language.JAPANESE)).toBe('麻疹');
    });

    it('should map Strep Throat to Japanese', () => {
      expect(mapDiseaseName('Strep Throat', Language.JAPANESE)).toBe('溶連菌感染症');
      expect(mapDiseaseName('Streptococcal Pharyngitis', Language.JAPANESE)).toBe('溶連菌感染症');
    });
  });

  describe('requiresMedicalClearance', () => {
    it('should return true for Influenza', () => {
      expect(requiresMedicalClearance('Influenza')).toBe(true);
      expect(requiresMedicalClearance('インフルエンザ')).toBe(true);
    });

    it('should return true for RSV', () => {
      expect(requiresMedicalClearance('RSV')).toBe(true);
      expect(requiresMedicalClearance('RSウイルス感染症')).toBe(true);
    });

    it('should return true for Strep Throat', () => {
      expect(requiresMedicalClearance('Strep Throat')).toBe(true);
      expect(requiresMedicalClearance('溶連菌感染症')).toBe(true);
    });

    it('should return true for Chickenpox', () => {
      expect(requiresMedicalClearance('Chickenpox')).toBe(true);
      expect(requiresMedicalClearance('水痘')).toBe(true);
    });

    it('should return true for Measles', () => {
      expect(requiresMedicalClearance('Measles')).toBe(true);
      expect(requiresMedicalClearance('麻疹')).toBe(true);
    });

    it('should return false for Norovirus', () => {
      expect(requiresMedicalClearance('Norovirus')).toBe(false);
      expect(requiresMedicalClearance('ノロウイルス')).toBe(false);
    });

    it('should return false for Hand-Foot-Mouth Disease', () => {
      expect(requiresMedicalClearance('Hand-Foot-Mouth Disease')).toBe(false);
      expect(requiresMedicalClearance('手足口病')).toBe(false);
    });

    it('should handle partial matching', () => {
      expect(requiresMedicalClearance('Influenza A')).toBe(true);
      expect(requiresMedicalClearance('RSV Infection')).toBe(true);
    });
  });
});
