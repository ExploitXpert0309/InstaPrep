import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Edit2, Loader2, Link as LinkIcon, Camera } from "lucide-react";

import { supabase } from "@/integrations/supabase/client"; // Import Supabase Client

export default function Profile() {
    const { profile, updateProfile, user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false); // New uploading state

    // Form State
    const [formData, setFormData] = useState({
        full_name: "",
        education: "",
        field_of_study: "",
        bio: "",
        avatar_url: "",
        cover_url: ""
    });

    // Initialize form with profile data
    useEffect(() => {
        if (profile) {
            setFormData({
                full_name: profile.full_name || "",
                education: profile.education || "",
                field_of_study: profile.field_of_study || "",
                bio: profile.bio || "",
                avatar_url: profile.avatar_url || "",
                cover_url: profile.cover_url || ""
            });
        }
    }, [profile]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('You must select an image to upload.');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `${user?.id}-avatar-${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, avatar_url: data.publicUrl }));

            toast({
                title: "Avatar Uploaded",
                description: "Don't forget to save your profile changes!",
            });

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Upload Failed",
                description: error.message || "Error uploading avatar.",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);

            if (!event.target.files || event.target.files.length === 0) {
                throw new Error('You must select an image to upload.');
            }

            const file = event.target.files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `${user?.id}-cover-${Math.random()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

            setFormData(prev => ({ ...prev, cover_url: data.publicUrl }));

            toast({
                title: "Cover Photo Uploaded",
                description: "Don't forget to save your profile changes!",
            });

        } catch (error: any) {
            console.error(error);
            toast({
                title: "Upload Failed",
                description: error.message || "Error uploading cover photo.",
                variant: "destructive",
            });
        } finally {
            setUploading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        const { error } = await updateProfile(formData);
        setLoading(false);

        if (error) {
            toast({
                title: "Update Failed",
                description: error.message,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Profile Updated",
                description: "Your changes have been saved successfully.",
            });
            setIsEditing(false);
        }
    };

    if (!user || !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                    <Link to="/dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <h1 className="text-xl font-display font-bold">My Profile</h1>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8 max-w-3xl">
                <div className="grid gap-6">

                    {/* Identity Card */}
                    <Card className="overflow-hidden">
                        <div className="h-32 relative group">
                            {formData.cover_url ? (
                                <img src={formData.cover_url} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-r from-purple-500 to-blue-500"></div>
                            )}

                            {isEditing && (
                                <div className="absolute top-2 right-2">
                                    <Label htmlFor="cover-upload" className="cursor-pointer">
                                        <div className="bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-colors backdrop-blur-sm">
                                            <Camera className="h-4 w-4" />
                                        </div>
                                    </Label>
                                    <Input
                                        id="cover-upload"
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={uploadCover}
                                        disabled={uploading}
                                    />
                                </div>
                            )}
                        </div>
                        <CardContent className="pt-0 relative px-6 md:px-10 pb-8">
                            <div className="flex flex-col md:flex-row gap-6 items-start -mt-12">
                                <div className="relative group">
                                    <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                                        <AvatarImage src={formData.avatar_url} alt={formData.full_name} className="object-cover" />
                                        <AvatarFallback className="text-4xl bg-muted text-muted-foreground">
                                            {formData.full_name.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    {isEditing && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            <span className="text-white text-xs font-bold">Change Image</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 mt-12 md:mt-14 space-y-1">
                                    <h2 className="text-2xl font-bold font-display">{profile.full_name}</h2>
                                    <p className="text-muted-foreground">{profile.education} • {profile.field_of_study}</p>
                                </div>

                                <div className="mt-12 md:mt-14">
                                    {!isEditing ? (
                                        <Button onClick={() => setIsEditing(true)} variant="outline" className="gap-2">
                                            <Edit2 className="h-4 w-4" /> Edit Profile
                                        </Button>
                                    ) : (
                                        <div className="flex gap-2">
                                            <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={loading || uploading}>Cancel</Button>
                                            <Button onClick={handleSave} disabled={loading || uploading} className="gap-2">
                                                {loading && <Loader2 className="animate-spin h-4 w-4" />} Save
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Edit Form / Details */}
                    {isEditing ? (
                        <Card className="animate-in slide-in-from-bottom-4 fade-in">
                            <CardHeader>
                                <CardTitle>Edit Details</CardTitle>
                                <CardDescription>Update your personal information.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="full_name">Full Name</Label>
                                        <Input id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="avatar">Profile Image</Label>
                                        <div className="relative">
                                            <Input
                                                id="avatar"
                                                type="file"
                                                accept="image/*"
                                                onChange={uploadAvatar}
                                                disabled={uploading}
                                                className="cursor-pointer"
                                            />
                                            {uploading && <p className="text-xs text-muted-foreground mt-1 animate-pulse">Uploading...</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="education">Higher Education</Label>
                                        <Input id="education" name="education" value={formData.education} onChange={handleChange} placeholder="e.g. B.Tech, Masters" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="field_of_study">Field of Study</Label>
                                        <Input id="field_of_study" name="field_of_study" value={formData.field_of_study} onChange={handleChange} placeholder="e.g. Computer Science" />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="bio">Passion / About</Label>
                                    <Textarea
                                        id="bio"
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleChange}
                                        placeholder="Share your passion, interests, or a short bio (like your WhatsApp status)..."
                                        className="min-h-[100px]"
                                    />
                                    <p className="text-xs text-muted-foreground">This will be displayed on your profile.</p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        // View Mode
                        <div className="grid gap-6 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>About Me</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                                        {profile.bio || "No bio added yet. Click 'Edit Profile' to add your passion!"}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Education</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <h4 className="font-medium">Higher Education</h4>
                                        <p className="text-muted-foreground">{profile.education || "Not specified"}</p>
                                    </div>
                                    <div>
                                        <h4 className="font-medium">Field of Study</h4>
                                        <p className="text-muted-foreground">{profile.field_of_study || "Not specified"}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
}
