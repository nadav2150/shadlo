import { useState, useEffect } from "react";
import { useLoaderData, useSubmit, useActionData, Form } from "@remix-run/react";
import { json, redirect, type HeadersFunction } from "@remix-run/node";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { AlertCircle, CheckCircle, XCircle, Save, User, Mail, Bell, Shield, Calendar, ToggleLeft, ToggleRight } from "lucide-react";
import { Button, Input, Label } from "~/components/ui";
import { auth, getCurrentUser, db } from "~/lib/firebase";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  addDoc,
  serverTimestamp 
} from "firebase/firestore";

interface LoaderData {
  user: {
    email: string | null;
    uid: string;
    emailVerified: boolean;
    createdAt?: string;
    lastSignInAt?: string;
  } | null;
  status?: {
    type: "success" | "error";
    message: string;
  };
  settings: {
    emailNotificationsEnabled: boolean;
    reportFrequency: string;
    reportEmailAddress: string;
    companyName: string;
    sendOnEmailDate?: string;
  };
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    // Get current user from Firebase Auth
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
      return redirect("/sign-in");
    }

    // Try to get existing settings from Firestore
    let userSettings = {
      emailNotificationsEnabled: true,
      reportFrequency: "weekly",
      reportEmailAddress: "",
      companyName: "",
      sendOnEmailDate: "",
    };

    try {
      const clientsRef = collection(db, "clients");
      const q = query(clientsRef, where("email", "==", currentUser.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0].data();
        // Handle sendOnEmailDate - convert Firestore timestamp to string if needed
        let sendOnEmailDate = "";
        if (userDoc.sendOnEmailDate !== null && userDoc.sendOnEmailDate !== undefined) {
          if (userDoc.sendOnEmailDate.toDate) {
            // It's a Firestore timestamp
            sendOnEmailDate = userDoc.sendOnEmailDate.toDate().toISOString();
          } else if (userDoc.sendOnEmailDate instanceof Date) {
            // It's already a Date object
            sendOnEmailDate = userDoc.sendOnEmailDate.toISOString();
          } else {
            // It's already a string
            sendOnEmailDate = userDoc.sendOnEmailDate;
          }
        }
        
        userSettings = {
          emailNotificationsEnabled: userDoc.emailNotificationsEnabled ?? true,
          reportFrequency: userDoc.reportFrequency ?? "weekly",
          reportEmailAddress: userDoc.reportEmailAddress ?? "",
          companyName: userDoc.companyName ?? "",
          sendOnEmailDate: sendOnEmailDate,
        };
      }
    } catch (firestoreError) {
      console.error("Error loading user settings from Firestore:", firestoreError);
      // Continue with default settings if Firestore fails
    }

    return json({
      user: {
        email: currentUser.email,
        uid: currentUser.uid,
        emailVerified: currentUser.emailVerified,
        createdAt: currentUser.metadata.creationTime,
        lastSignInAt: currentUser.metadata.lastSignInTime,
      },
      settings: userSettings,
    });
  } catch (error) {
    console.error("Error loading user data:", error);
    return json({
      user: null,
      status: {
        type: "error",
        message: "Failed to load user data",
      },
    });
  }
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const emailNotificationsEnabled = formData.get("emailNotificationsEnabled") === "true";
  const emailNotifications = formData.get("emailNotifications")?.toString() || "weekly";
  const reportEmail = formData.get("reportEmail")?.toString() || "";
  const companyName = formData.get("companyName")?.toString().trim() || "";

  try {
    // Get current user
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return json({
        status: {
          type: "error",
          message: "User not authenticated",
        },
      });
    }

    // Check if user already exists in clients collection
    const clientsRef = collection(db, "clients");
    const q = query(clientsRef, where("email", "==", currentUser.email));
    const querySnapshot = await getDocs(q);

    // Calculate new sendOnEmailDate based on report frequency and account creation date
    let newSendOnEmailDate = null;
    if (!querySnapshot.empty && emailNotificationsEnabled) {
      const userDoc = querySnapshot.docs[0].data();
      const createdAt = userDoc.createdAt;
      
      if (createdAt) {
        // Get the account creation date
        let creationDate: Date;
        if (createdAt.toDate) {
          // It's a Firestore timestamp
          creationDate = createdAt.toDate();
        } else if (createdAt instanceof Date) {
          // It's already a Date object
          creationDate = createdAt;
        } else {
          // It's a string, try to parse it
          creationDate = new Date(createdAt);
        }
        
        // Calculate days to add based on frequency
        const daysToAdd = emailNotifications === "monthly" ? 30 : 7;
        newSendOnEmailDate = new Date(creationDate.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
      }
    }

    const settingsData = {
      emailNotificationsEnabled: emailNotificationsEnabled,
      reportFrequency: emailNotifications,
      reportEmailAddress: reportEmail || currentUser.email,
      companyName: companyName,
      lastSettingsUpdate: serverTimestamp(),
      sendOnEmailDate: emailNotificationsEnabled ? newSendOnEmailDate : null
    };

    if (!querySnapshot.empty) {
      // User exists, update their settings
      const userDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "clients", userDoc.id), settingsData);
    } else {
      // User doesn't exist, create new document with settings
      const newClientData = {
        email: currentUser.email,
        lastSignInAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        ...settingsData
      };

      const docRef = await addDoc(collection(db, "clients"), newClientData);
    }
    
    return json({
      status: {
        type: "success",
        message: "Settings saved successfully",
      },
    });
  } catch (error) {
    console.error("Error saving settings to Firestore:", error);
    return json({
      status: {
        type: "error",
        message: "Failed to save settings",
      },
    });
  }
};

export default function Settings() {
  const { user, status: initialStatus, settings } = useLoaderData<LoaderData>();
  const actionData = useActionData<LoaderData>();
  const submit = useSubmit();
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(settings?.emailNotificationsEnabled ?? true);
  const [emailNotifications, setEmailNotifications] = useState(settings?.reportFrequency ?? "weekly");
  const [reportEmail, setReportEmail] = useState(settings?.reportEmailAddress ?? "");
  const [companyName, setCompanyName] = useState(settings?.companyName ?? "");
  const [isEditingCompany, setIsEditingCompany] = useState(false);

  // Use action data status if available, otherwise use initial status
  const status = actionData?.status || initialStatus;

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "N/A";
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Invalid Date";
    }
  };

  const handleToggleEmailNotifications = () => {
    setEmailNotificationsEnabled(!emailNotificationsEnabled);
  };

  const handleEmailNotificationChange = (value: string) => {
    setEmailNotifications(value);
  };

  const handleSaveSettings = () => {
    const formData = new FormData();
    formData.append("emailNotificationsEnabled", emailNotificationsEnabled.toString());
    formData.append("emailNotifications", emailNotifications);
    formData.append("reportEmail", reportEmail);
    formData.append("companyName", companyName);
    submit(formData, { method: "post" });
  };

  const handleEditCompany = () => {
    setIsEditingCompany(true);
    // Set the current company name in the input field
    setCompanyName(companyName);
  };

  const handleCancelEditCompany = () => {
    setIsEditingCompany(false);
    // Restore the original company name from settings
    setCompanyName(settings?.companyName ?? "");
  };

  const handleSaveCompany = () => {
    setIsEditingCompany(false);
    // Save immediately when user confirms
    const formData = new FormData();
    formData.append("emailNotificationsEnabled", emailNotificationsEnabled.toString());
    formData.append("emailNotifications", emailNotifications);
    formData.append("reportEmail", reportEmail);
    formData.append("companyName", companyName);
    submit(formData, { method: "post" });
  };

  if (!user) {
    return (
      <div className="p-8 pt-6 w-full max-w-full min-h-screen bg-[#181C23] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 pt-6 w-full max-w-full min-h-screen bg-[#181C23]">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-white">Settings</h1>
        </div>

        {/* Status Message */}
        {status && (
          <div className={`rounded-xl p-6 mb-8 ${
            status.type === "success" 
              ? "bg-green-900/20 border border-green-500/20" 
              : "bg-red-900/20 border border-red-500/20"
          }`}>
            <div className="flex items-center gap-3">
              {status.type === "success" ? (
                <CheckCircle className="w-6 h-6 text-green-400" />
              ) : (
                <XCircle className="w-6 h-6 text-red-400" />
              )}
              <p className="text-white">{status.message}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* User Information */}
          <div className="bg-[#1a1f28] rounded-xl p-6 border border-[#23272f]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-600/20 rounded-lg">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">User Information</h2>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-gray-400 text-sm">Email Address</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <p className="text-white font-medium">{user.email}</p>
                  {user.emailVerified && (
                    <span className="bg-green-900/20 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/20">
                      Verified
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-gray-400 text-sm">Company Name</Label>
                <div className="mt-1">
                  {isEditingCompany ? (
                    <div className="space-y-2">
                      <Input
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Enter your company name"
                        className="bg-[#23272f] border-[#2d333b] text-white"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveCompany}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          Save
                        </Button>
                        <Button
                          onClick={handleCancelEditCompany}
                          size="sm"
                          variant="outline"
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-purple-600/20 rounded">
                          <User className="w-4 h-4 text-purple-400" />
                        </div>
                        <p className="text-white">
                          {companyName || "No company name set"}
                        </p>
                      </div>
                      <Button
                        onClick={handleEditCompany}
                        size="sm"
                        variant="outline"
                        className="border-gray-600 text-gray-300 hover:bg-gray-700"
                      >
                        {companyName ? "Edit" : "Add"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-gray-400 text-sm">User ID</Label>
                <p className="text-gray-300 text-sm font-mono mt-1">{user.uid}</p>
              </div>

              <div>
                <Label className="text-gray-400 text-sm">Account Created</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <p className="text-white">{formatDate(user.createdAt)}</p>
                </div>
              </div>

              <div>
                <Label className="text-gray-400 text-sm">Last Sign In</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <p className="text-white">{formatDate(user.lastSignInAt)}</p>
                </div>
              </div>

              <div>
                <Label className="text-gray-400 text-sm">Next Email Report Date</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <p className="text-white">
                    {emailNotificationsEnabled 
                      ? formatDate(settings?.sendOnEmailDate) 
                      : "Email notifications disabled"
                    }
                  </p>
                </div>
                {emailNotificationsEnabled && (
                  <p className="text-gray-500 text-xs mt-1">
                    Based on account creation + {emailNotifications === "monthly" ? "30" : "7"} days ({emailNotifications} frequency)
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Email Notifications */}
          <div className="bg-[#1a1f28] rounded-xl p-6 border border-[#23272f]">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-600/20 rounded-lg">
                <Bell className="w-6 h-6 text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Email Notifications</h2>
            </div>

            <div className="space-y-6">
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-[#23272f] rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="p-1.5 bg-blue-600/20 rounded">
                    <Bell className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Email Notifications</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      {emailNotificationsEnabled 
                        ? "Receive security reports via email" 
                        : "Email notifications are currently disabled"
                      }
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleEmailNotifications}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                  {emailNotificationsEnabled ? (
                    <ToggleRight className="w-6 h-6 text-blue-400" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>
              </div>

              {/* Report Email Input - Only show when enabled */}
              {emailNotificationsEnabled && (
                <div className="p-4 bg-[#23272f] rounded-lg">
                  <h3 className="text-white font-medium mb-3">Report Email Address</h3>
                  <div className="space-y-2">
                    <Label htmlFor="reportEmail" className="text-gray-400 text-sm">
                      Where should we send the security reports?
                    </Label>
                    <Input
                      id="reportEmail"
                      type="email"
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="Enter email address for reports"
                      className="bg-[#2d333b] border-[#4a5568] text-white"
                    />
                    <p className="text-gray-500 text-xs">
                      Leave empty to use your account email: {user.email}
                    </p>
                  </div>
                </div>
              )}

              {/* Report Frequency Section - Only show when enabled */}
              {emailNotificationsEnabled && (
                <div className="p-4 bg-[#23272f] rounded-lg">
                  <h3 className="text-white font-medium mb-3">Report Frequency</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="emailNotifications"
                        value="weekly"
                        checked={emailNotifications === "weekly"}
                        onChange={(e) => handleEmailNotificationChange(e.target.value)}
                        className="w-4 h-4 text-blue-600 bg-[#2d333b] border-[#4a5568] focus:ring-blue-500 focus:ring-2"
                      />
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-blue-600/20 rounded">
                          <Bell className="w-4 h-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">Weekly Reports</p>
                          <p className="text-gray-400 text-sm">
                            Receive security reports every week
                          </p>
                        </div>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="emailNotifications"
                        value="monthly"
                        checked={emailNotifications === "monthly"}
                        onChange={(e) => handleEmailNotificationChange(e.target.value)}
                        className="w-4 h-4 text-blue-600 bg-[#2d333b] border-[#4a5568] focus:ring-blue-500 focus:ring-2"
                      />
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-green-600/20 rounded">
                          <Calendar className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                          <p className="text-white font-medium">Monthly Reports</p>
                          <p className="text-gray-400 text-sm">
                            Receive security reports every month
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-[#23272f]">
              <Button
                onClick={handleSaveSettings}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Settings
              </Button>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-[#1a1f28] rounded-xl p-6 border border-[#23272f]">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-white mb-2">About Email Reports</p>
              <p className="mb-2">
                Your security reports will include:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Security risk assessments</li>
                <li>User activity summaries</li>
                <li>Policy compliance status</li>
                <li>System health overview</li>
              </ul>
              <p className="mt-3 text-blue-400">
                <strong>Next Email Report Date:</strong> Calculated as 7 days (weekly) or 30 days (monthly) after account creation. 
                Updates when you change frequency. No emails sent when notifications are disabled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 