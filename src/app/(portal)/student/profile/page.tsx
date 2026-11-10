"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StudentProfileData {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  status: string;
  studentProfile: {
    id: string;
    matricNumber: string;
    gender: string | null;
    dateOfBirth: string | null;
    address: string | null;
    department: {
      id: string;
      code: string;
      name: string;
      faculty: { id: string; code: string; name: string };
    };
    program: {
      id: string;
      code: string;
      name: string;
      durationYears: number;
    };
    level: {
      id: string;
      levelNumber: number;
      name: string;
    };
  } | null;
}

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/profile");
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Failed to load profile");
      }
      const data = json.data as StudentProfileData;
      setProfile(data);
      setPhone(data.phone ?? "");
      setGender(data.studentProfile?.gender ?? "");
      setDateOfBirth(
        data.studentProfile?.dateOfBirth
          ? data.studentProfile.dateOfBirth.slice(0, 10)
          : ""
      );
      setAddress(data.studentProfile?.address ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchProfile();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProfile]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const res = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim() || null,
          gender: gender.trim() || null,
          dateOfBirth: dateOfBirth || null,
          address: address.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const msg = json?.error?.message ?? "Failed to update profile";
        setFormError(msg);
        toast.error(msg);
        return;
      }

      setProfile(json.data);
      toast.success("Profile updated successfully");
    } catch {
      const msg = "Network error while updating profile.";
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Academic & Personal Profile"
        description="View your official university academic record and update your personal contact details."
      />

      {loading ? (
        <LoadingSkeleton rows={5} label="Loading your profile..." />
      ) : error || !profile ? (
        <ErrorState
          message={error ?? "Unable to load profile"}
          onRetry={fetchProfile}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Read-only Academic Record */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Official Academic Information (Read-Only)
              </CardTitle>
              <CardDescription>
                Managed by university administration. Contact your Department
                Admin for official corrections.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
              <div>
                <div className="text-muted-foreground">Full Name</div>
                <div className="font-semibold mt-0.5">{profile.fullName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">
                  Matriculation Number
                </div>
                <div className="font-mono font-semibold mt-0.5">
                  {profile.studentProfile?.matricNumber ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">University Email</div>
                <div className="font-medium mt-0.5 break-all">
                  {profile.email}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Faculty</div>
                <div className="font-medium mt-0.5">
                  {profile.studentProfile?.department.faculty.name ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Department</div>
                <div className="font-medium mt-0.5">
                  {profile.studentProfile?.department.name ?? "—"} (
                  {profile.studentProfile?.department.code ?? "—"})
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Degree Program</div>
                <div className="font-medium mt-0.5">
                  {profile.studentProfile?.program.name ?? "—"} (
                  {profile.studentProfile?.program.code ?? "—"})
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Current Level</div>
                <div className="font-semibold mt-0.5">
                  {profile.studentProfile?.level.name ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Program Duration</div>
                <div className="font-medium mt-0.5">
                  {profile.studentProfile?.program.durationYears ?? "—"} Years
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editable Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Personal & Contact Information
              </CardTitle>
              <CardDescription>
                Update your phone number, gender, date of birth, and residential
                address.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError ? (
                  <div
                    role="alert"
                    className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  >
                    {formError}
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-phone">Phone Number</Label>
                    <Input
                      id="prof-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      disabled={saving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-gender">Gender</Label>
                    <Input
                      id="prof-gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      placeholder="e.g. Female / Male"
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prof-dob">Date of Birth</Label>
                  <Input
                    id="prof-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prof-address">Residential Address</Label>
                  <Input
                    id="prof-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Hostel or residential address"
                    disabled={saving}
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

