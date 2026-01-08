import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Timer, Code, UserCircle, Briefcase, FileCheck, LogOut, BarChart3, Check, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Round Configuration
const ROUNDS = [
  {
    id: "oa",
    title: "Round 1: Online Assessment",
    description: "Aptitude, Coding Challenges & MCQs. The gatekeeper round.",
    icon: FileCheck,
    inputType: "count",
    defaultVal: 20,
    label: "Number of Questions"
  },
  {
    id: "tech1",
    title: "Round 2: Technical Interview I",
    description: "Core Data Structures, Algorithms & Basics.",
    icon: Code,
    inputType: "minutes",
    defaultVal: 30,
    label: "Duration (Minutes)"
  },
  {
    id: "tech2",
    title: "Round 3: Technical Interview II",
    description: "Advanced Deep Dive, System Design & Live Coding.",
    icon: Zap,
    inputType: "minutes",
    defaultVal: 45,
    label: "Duration (Minutes)"
  },
  {
    id: "behavioral",
    title: "Round 4: Managerial Round",
    description: "Culture fit, conflict resolution & leadership.",
    icon: UserCircle,
    inputType: "minutes",
    defaultVal: 20,
    label: "Duration (Minutes)"
  },
  {
    id: "hr",
    title: "Round 5: HR Discussion",
    description: "Policies, salary negotiation & final check.",
    icon: Briefcase,
    inputType: "minutes",
    defaultVal: 15,
    label: "Duration (Minutes)"
  }
];

const PREDEFINED_ROLES = [
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Developer",
  "Software Engineer",
  "DevOps Engineer",
  "Data Scientist",
  "Data Analyst",
  "Machine Learning Engineer",
  "Product Manager",
  "QA Engineer",
  "System Administrator",
  "Cloud Architect",
  "UI/UX Designer",
  "Mobile App Developer (iOS)",
  "Mobile App Developer (Android)",
  "Cybersecurity Analyst",
  "Game Developer",
  "Embedded Systems Engineer"
];

export default function Dashboard() {
  const { profile, signOut, user } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("Frontend Developer");

  // Combobox State
  const [openCombobox, setOpenCombobox] = useState(false);
  const [roleSearch, setRoleSearch] = useState(""); // For the input text in combobox



  // State to store input values for each round: { oa: 20, tech1: 30, ... }
  const [roundParams, setRoundParams] = useState<Record<string, number>>({
    oa: 20,
    tech1: 30,
    tech2: 45,
    behavioral: 20,
    hr: 15
  });

  const [difficulty, setDifficulty] = useState("Medium");

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleParamChange = (id: string, val: string) => {
    // Parse as integer to remove leading zeros (e.g., "05" -> 5)
    // If empty or NaN, default to 0 to keep controlled input valid
    const num = parseInt(val, 10);
    setRoundParams(prev => ({ ...prev, [id]: isNaN(num) ? 0 : num }));
  };

  const startRound = (roundId: string) => {
    const param = roundParams[roundId];
    navigate(`/test-session?role=${encodeURIComponent(role)}&type=${roundId}&count=${param}&level=${difficulty}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">InstaPrep</h1>
          </div>
          <div className="flex items-center gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden hover:bg-transparent group">
                  <Avatar className="h-10 w-10 border-2 border-primary/20 group-hover:border-primary group-hover:scale-105 transition-all cursor-pointer shadow-sm relative z-10">
                    <AvatarImage src={profile?.avatar_url || ""} alt={profile?.full_name || "Profile"} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/10 to-primary/20 text-primary font-bold text-lg">
                      {profile?.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="grid gap-4">
                  <div className="space-y-2 border-b pb-2">
                    <h4 className="font-display font-semibold leading-none text-lg">Your Profile</h4>
                    <p className="text-sm text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <div className="pt-2 grid gap-2">
                    <Link to="/profile">
                      <Button variant="default" className="w-full h-8 text-xs">Edit Profile</Button>
                    </Link>
                    <Link to="/progress">
                      <Button variant="outline" className="w-full h-8 text-xs">View Progress</Button>
                    </Link>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Welcome */}
        <div className="animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-2">
            Welcome back, {profile?.full_name?.split(" ")[0] || "User"}! 👋
          </h2>
          <p className="text-muted-foreground text-lg">
            Prepare for your {role} interview journey.
          </p>
        </div>

        {/* Role Selection */}
        <div className="max-w-md space-y-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <Label>Target Job Role</Label>
          <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openCombobox}
                className="w-full justify-between h-12 text-lg font-normal"
              >
                {role || "Select role..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search job role..." onValueChange={setRoleSearch} />
                <CommandList>
                  <CommandEmpty>
                    <p className="text-sm text-muted-foreground p-2">Role not found.</p>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-primary h-auto py-1.5 px-2"
                      onClick={() => {
                        setRole(roleSearch);
                        setOpenCombobox(false);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Use "{roleSearch}"
                    </Button>
                  </CommandEmpty>
                  <CommandGroup>
                    {PREDEFINED_ROLES.map((r) => (
                      <CommandItem
                        key={r}
                        value={r}
                        onSelect={(currentValue) => {
                          setRole(currentValue === role ? "" : currentValue);
                          setOpenCombobox(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            role === r ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {r}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>



        {/* Difficulty Selection */}
        <div className="max-w-md space-y-2 animate-fade-in" style={{ animationDelay: '150ms' }}>
          <Label>Difficulty Level</Label>
          <Tabs defaultValue="Medium" onValueChange={setDifficulty} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="Easy">Easy</TabsTrigger>
              <TabsTrigger value="Medium">Medium</TabsTrigger>
              <TabsTrigger value="Hard">Hard</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Rounds Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ROUNDS.map((round, index) => {
            const Icon = round.icon;
            return (
              <Card key={round.id} className="hover:shadow-lg transition-all border-t-4 hover:border-primary/50 animate-slide-up" style={{ borderTopColor: 'hsl(var(--primary))', animationDelay: `${index * 100 + 200}ms` }}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded">
                      {round.inputType === 'count' ? 'Test' : 'Interview'}
                    </span>
                  </div>
                  <CardTitle className="text-lg">{round.title}</CardTitle>
                  <CardDescription className="text-xs line-clamp-2 min-h-[2.5em]">{round.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-1">
                    <Label htmlFor={`param-${round.id}`} className="text-xs text-muted-foreground">
                      {round.label}
                    </Label>
                    <Input
                      id={`param-${round.id}`}
                      type="number"
                      min="1"
                      value={roundParams[round.id]}
                      onChange={(e) => handleParamChange(round.id, e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button onClick={() => startRound(round.id)} className="w-full">
                    Start Round
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {/* Progress Card */}
          <Card className="hover:shadow-lg transition-all border-t-4 hover:border-emerald-500 animate-slide-up" style={{ borderTopColor: '#10b981', animationDelay: '800ms' }}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-1 rounded">
                  Analytics
                </span>
              </div>
              <CardTitle className="text-lg">Progress Report</CardTitle>
              <CardDescription className="text-xs line-clamp-2 min-h-[2.5em]">
                View your performance analytics, test history, and improvement trends.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground h-8 flex items-center">
                  Track your growth over time.
                </p>
              </div>
              <Button onClick={() => navigate("/progress")} variant="outline" className="w-full border-emerald-500 text-emerald-600 hover:bg-emerald-50">
                View Report
              </Button>
            </CardContent>
          </Card>
        </div>
      </main >
    </div >
  );
}
