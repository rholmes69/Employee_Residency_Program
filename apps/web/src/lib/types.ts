import type { ApplicationStatus, Role } from '@erp/shared';

export interface Me {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface SupervisorReview {
  decision: 'APPROVED' | 'DECLINED';
  comment: string | null;
  decidedAt: string;
}

export interface Cycle {
  id: string;
  name: string;
  description: string | null;
  opensAt: string;
  deadline: string;
  hrContactName: string;
  hrContactEmail: string;
  isActive: boolean;
}

export interface Application {
  id: string;
  status: ApplicationStatus;
  fullName: string;
  jobTitle: string;
  department: string;
  supervisorName: string;
  supervisorEmail: string;
  lengthOfEmployment: string;
  email: string;
  phone: string;
  reasons: string[];
  reasonOther: string | null;
  hopeToGain: string;
  interestAreas: string[];
  interestOther: string | null;
  goals: string;
  strengths: string;
  willingToParticipate: boolean | null;
  acknowledged: boolean;
  signatureName: string | null;
  signedAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  cycle?: Cycle;
  supervisorReview?: SupervisorReview | null;
}

export interface Mentor {
  id: string;
  name: string;
  email: string;
  title: string;
  department: string;
  expertiseAreas: string[];
  bio: string;
  capacity: number;
  active: boolean;
  assignedCount?: number;
}

export interface MentorMatch {
  id: string;
  mentorId: string;
  score: number;
  rationale: string;
  status: 'SUGGESTED' | 'ASSIGNED' | 'DISMISSED';
  mentor: Mentor;
}

export interface AiAssessment {
  id: string;
  model: string;
  summary: string;
  scores: Record<string, number>;
  total: number;
  strengths: string[];
  concerns: string[];
  suggestedRotations: string[];
  createdAt: string;
}

export interface Review {
  id: string;
  scores: Record<string, number>;
  total: number;
  recommendation: string;
  notes: string | null;
  createdAt: string;
  reviewer: { id: string; name: string; email: string };
}

export interface ApplicationDetail extends Application {
  viewerRelation: 'staff' | 'applicant' | 'supervisor';
  reviews?: Review[];
  aiAssessments?: AiAssessment[];
  mentorMatches: MentorMatch[];
}

export interface ApplicationRow {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  lengthOfEmployment: string;
  status: ApplicationStatus;
  interestAreas: string[];
  submittedAt: string | null;
  supervisorName: string;
  aiScore: number | null;
  reviewCount: number;
  avgReviewScore: number | null;
  assignedMentors: string[];
}
