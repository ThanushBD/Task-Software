"use client";

import React, { useActionState, useEffect, useRef, useState, useCallback, memo } from "react";
import { useFormStatus } from "react-dom";
import { 
  suggestDeadlineAction, 
  type SuggestDeadlineActionState, 
  parseTaskFromTextAction, 
  type ParseTaskFromTextActionState 
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  Terminal, 
  CheckCircle, 
  AlertCircle, 
  Lightbulb, 
  Wand2, 
  Sparkles,
  Brain,
  Clock,
  Target,
  Calendar,
  Zap,
  Copy,
  RotateCcw,
  TrendingUp,
  Bot
} from "lucide-react";
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  {
    category: "Meeting Tasks",
    examples: [
      "Schedule a team meeting for next Monday at 2 PM to discuss Q3 roadmap",
      "Organize all-hands meeting by Friday high priority with venue booking",
      "Set up weekly standup meetings starting next week medium priority"
    ]
  },
  {
    category: "Development Tasks", 
    examples: [
      "Fix login bug by next Wednesday high priority",
      "Implement user authentication feature with 2FA by end of month",
      "Review and optimize database queries low priority next week"
    ]
  },
  {
    category: "Content Tasks",
    examples: [
      "Write blog post about new product features by Thursday",
      "Create marketing materials for Q4 campaign high priority",
      "Update documentation for API changes medium priority"
    ]
  },
  {
    category: "Analysis Tasks",
    examples: [
      "Analyze user feedback data and create report by next Friday",
      "Research competitor pricing strategies medium priority this month",
      "Conduct usability testing for new interface high priority"
    ]
  }
] as const;

const DEADLINE_ANALYSIS_EXAMPLES = [
  {
    category: "Software Development",
    example: "Develop a new user authentication system including two-factor authentication, social logins, password reset functionality, and admin dashboard integration"
  },
  {
    category: "Content Creation", 
    example: "Create a comprehensive marketing campaign including social media content, blog posts, email templates, and promotional videos for the product launch"
  },
  {
    category: "Data Analysis",
    example: "Analyze customer behavior data from the past 6 months, identify trends, create visualizations, and present actionable insights to stakeholders"
  },
  {
    category: "Process Improvement",
    example: "Review current onboarding process, identify bottlenecks, design improved workflow, create documentation, and train team members"
  }
] as const;

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingText: string;
}

const SubmitButton = memo(({ children, pendingText }: SubmitButtonProps) => {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto min-w-[200px]">
      {pending ? (
        <>
          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
});

SubmitButton.displayName = "SubmitButton";

const ExamplePrompts = memo(({ onSelectExample }: { onSelectExample: (text: string) => void }) => (
  <div className="space-y-4">
    <h4 className="text-sm font-medium flex items-center gap-2">
      <Lightbulb className="h-4 w-4 text-yellow-500" />
      Example Prompts (click to use)
    </h4>
    <div className="grid gap-3">
      {EXAMPLE_PROMPTS.map((category) => (
        <div key={category.category} className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {category.category}
          </h5>
          <div className="space-y-1">
            {category.examples.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSelectExample(example)}
                className="w-full text-left text-sm p-3 rounded-lg border border-muted hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-start gap-2">
                  <Copy className="h-3 w-3 mt-0.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="leading-relaxed">{example}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
));

ExamplePrompts.displayName = "ExamplePrompts";

const ParsedResultDisplay = memo(({ data }: { data: any }) => (
  <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-900/30">
    <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
    <AlertTitle className="font-semibold text-blue-700 dark:text-blue-300">
      🎉 AI Successfully Parsed Your Task!
    </AlertTitle>
    <AlertDescription className="text-blue-600 dark:text-blue-400">
      <div className="mt-4 space-y-4">
        {data.title && (
          <div className="bg-white/50 dark:bg-blue-800/30 p-3 rounded-lg">
            <h5 className="font-semibold flex items-center gap-2 mb-2">
              <Target className="h-4 w-4" />
              Task Title
            </h5>
            <p className="text-sm">{data.title}</p>
          </div>
        )}
        
        {data.description && (
          <div className="bg-white/50 dark:bg-blue-800/30 p-3 rounded-lg">
            <h5 className="font-semibold flex items-center gap-2 mb-2">
              <Terminal className="h-4 w-4" />
              Description
            </h5>
            <p className="text-sm leading-relaxed">{data.description}</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.deadline && (
            <div className="bg-white/50 dark:bg-blue-800/30 p-3 rounded-lg">
              <h5 className="font-semibold flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4" />
                Suggested Deadline
              </h5>
              <p className="text-sm">
                {format(parseISO(data.deadline), "PPPppp ' ('EEEE')'")}
              </p>
            </div>
          )}
          
          {data.priority && (
            <div className="bg-white/50 dark:bg-blue-800/30 p-3 rounded-lg">
              <h5 className="font-semibold flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4" />
                Suggested Priority
              </h5>
              <Badge variant="outline" className="text-sm">
                {data.priority}
              </Badge>
            </div>
          )}
        </div>
        
        {data.reasoning && (
          <div className="bg-white/50 dark:bg-blue-800/30 p-3 rounded-lg">
            <h5 className="font-semibold flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4" />
              AI Reasoning
            </h5>
            <p className="text-xs italic leading-relaxed">{data.reasoning}</p>
          </div>
        )}
        
        <div className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <Lightbulb className="h-3 w-3" />
            <strong>Next Step:</strong> Use these details to manually create a task in the Admin panel, 
            or copy the information for your task management system.
          </p>
        </div>
      </div>
    </AlertDescription>
  </Alert>
));

ParsedResultDisplay.displayName = "ParsedResultDisplay";

const DeadlineSuggestionDisplay = memo(({ data }: { data: any }) => (
  <Alert className="border-green-500 bg-green-50 dark:bg-green-900/30">
    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
    <AlertTitle className="font-semibold text-green-700 dark:text-green-300">
      🎯 AI Deadline Analysis Complete!
    </AlertTitle>
    <AlertDescription className="text-green-600 dark:text-green-400">
      <div className="mt-4 space-y-4">
        <div className="bg-white/50 dark:bg-green-800/30 p-4 rounded-lg">
          <h5 className="font-semibold flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5" />
            Recommended Timeline
          </h5>
          <p className="text-lg font-bold mb-2">
            {data.suggestedDeadline ? 
              format(parseISO(data.suggestedDeadline), "PPPppp ' ('EEEE')'") : 
              "Analysis in progress..."}
          </p>
        </div>
        
        <div className="bg-white/50 dark:bg-green-800/30 p-4 rounded-lg">
          <h5 className="font-semibold flex items-center gap-2 mb-3">
            <Brain className="h-5 w-5" />
            Analysis & Reasoning
          </h5>
          <p className="text-sm leading-relaxed">{data.reasoning}</p>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <strong>Pro Tip:</strong> This AI-suggested deadline considers task complexity, 
            typical development timelines, and buffer time for quality assurance.
          </p>
        </div>
      </div>
    </AlertDescription>
  </Alert>
));

DeadlineSuggestionDisplay.displayName = "DeadlineSuggestionDisplay";

const NaturalLanguageTaskCreator = memo(() => {
  const initialParseState: ParseTaskFromTextActionState = { success: false };
  const [parseState, parseFormAction] = useActionState(parseTaskFromTextAction, initialParseState);
  const parseFormRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();
  const [inputText, setInputText] = useState("");
  const [showExamples, setShowExamples] = useState(false);

  useEffect(() => {
    if (parseState.message && !parseState.success) {
      toast({
        title: "AI Parsing Error",
        description: parseState.message,
        variant: "destructive",
      });
    }
  }, [parseState, toast]);

  const handleExampleSelect = useCallback((example: string) => {
    setInputText(example);
    setShowExamples(false);
  }, []);

  const handleReset = useCallback(() => {
    setInputText("");
    parseFormRef.current?.reset();
  }, []);

  return (
    <Card className="shadow-lg border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" />
          AI Task Parser
          <Badge variant="secondary" className="ml-auto">Beta</Badge>
        </CardTitle>
        <CardDescription>
          Describe your task in plain English and let AI extract structured details like 
          title, description, priority, and deadline automatically.
        </CardDescription>
      </CardHeader>

      <form action={parseFormAction} ref={parseFormRef}>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="naturalLanguageInput" className="text-sm font-medium">
                Describe Your Task Idea
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExamples(!showExamples)}
                  className="text-xs"
                >
                  <Lightbulb className="mr-1 h-3 w-3" />
                  {showExamples ? "Hide" : "Show"} Examples
                </Button>
                {inputText && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="text-xs"
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {showExamples && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <ExamplePrompts onSelectExample={handleExampleSelect} />
              </div>
            )}

            <Textarea
              id="naturalLanguageInput"
              name="naturalLanguageInput"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g., 'Schedule a team meeting for next Monday at 2 PM to discuss Q3 roadmap high priority'"
              rows={4}
              className="mt-1 resize-none"
              required
              maxLength={1000}
            />
            
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Be specific about deadlines, priority, and requirements</span>
              <span>{inputText.length}/1000 characters</span>
            </div>

            {parseState.errors?.naturalLanguageInput && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {parseState.errors.naturalLanguageInput.join(", ")}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-4">
          <div className="flex justify-end">
            <SubmitButton pendingText="AI is parsing your task...">
              <Sparkles className="mr-2 h-4 w-4" />
              Parse with AI
            </SubmitButton>
          </div>

          {parseState.errors?._form && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Parsing Error</AlertTitle>
              <AlertDescription>{parseState.errors._form.join(", ")}</AlertDescription>
            </Alert>
          )}

          {parseState.success && parseState.data && (
            <ParsedResultDisplay data={parseState.data} />
          )}
        </CardFooter>
      </form>
    </Card>
  );
});

NaturalLanguageTaskCreator.displayName = "NaturalLanguageTaskCreator";

const DeadlineOptimizer = memo(() => {
  const initialSuggestState: SuggestDeadlineActionState = { success: false };
  const [suggestState, suggestFormAction] = useActionState(suggestDeadlineAction, initialSuggestState);
  const { toast } = useToast();
  const suggestFormRef = useRef<HTMLFormElement>(null);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (suggestState.message) {
      if (suggestState.success) {
        toast({
          title: "AI Analysis Complete",
          description: "Deadline suggestion generated successfully!",
          variant: "default",
        });
      } else {
        toast({
          title: "Analysis Error",
          description: suggestState.message,
          variant: "destructive",
        });
      }
    }
  }, [suggestState, toast]);

  const handleExampleSelect = useCallback((example: string) => {
    setDescription(example);
  }, []);

  return (
    <Card className="shadow-lg border-amber-200 dark:border-amber-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-6 w-6 text-amber-600" />
          AI Deadline Optimizer
          <Badge variant="secondary" className="ml-auto">Smart Analysis</Badge>
        </CardTitle>
        <CardDescription>
          Describe your task in detail and get AI-powered deadline recommendations 
          based on complexity, scope, and best practices.
        </CardDescription>
      </CardHeader>

      <form action={suggestFormAction} ref={suggestFormRef}>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label htmlFor="taskDescription" className="text-sm font-medium">
              Task Description for Analysis
            </Label>
            
            <div className="space-y-3">
              <div className="text-sm">
                <p className="text-muted-foreground mb-2">Quick examples to try:</p>
                <div className="grid gap-2">
                  {DEADLINE_ANALYSIS_EXAMPLES.map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleExampleSelect(item.example)}
                      className="text-left p-2 rounded border border-muted hover:bg-muted/50 transition-colors text-xs"
                    >
                      <span className="font-medium text-primary">{item.category}:</span> {item.example}
                    </button>
                  ))}
                </div>
              </div>
              
              <Textarea
                id="taskDescription"
                name="taskDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your task in detail including requirements, deliverables, complexity, dependencies, and any specific constraints..."
                rows={6}
                className="resize-none"
                required
                maxLength={2000}
              />
              
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Include complexity, dependencies, and scope details for better analysis</span>
                <span>{description.length}/2000 characters</span>
              </div>
            </div>

            {suggestState.errors?.taskDescription && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {suggestState.errors.taskDescription.join(", ")}
              </p>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex flex-col items-stretch gap-4">
          <div className="flex justify-end">
            <SubmitButton pendingText="AI is analyzing complexity...">
              <Zap className="mr-2 h-4 w-4" />
              Get AI Deadline Suggestion
            </SubmitButton>
          </div>

          {suggestState.errors?._form && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Analysis Error</AlertTitle>
              <AlertDescription>{suggestState.errors._form.join(", ")}</AlertDescription>
            </Alert>
          )}

          {suggestState.success && suggestState.data && (
            <DeadlineSuggestionDisplay data={suggestState.data} />
          )}
        </CardFooter>
      </form>
    </Card>
  );
});

DeadlineOptimizer.displayName = "DeadlineOptimizer";

export function AiOptimizerPage() {
  return (
    <div className="p-4 md:p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold font-headline text-foreground flex items-center justify-center gap-3">
          <Bot className="h-8 w-8 text-primary" />
          AI Task Assistant
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Leverage artificial intelligence to streamline your task creation and planning process. 
          Get smart suggestions for deadlines, priorities, and task structuring.
        </p>
      </div>
      
      {/* AI Features Grid */}
      <div className="grid gap-8 lg:grid-cols-1 xl:grid-cols-1">
        <NaturalLanguageTaskCreator />
        
        <Separator className="my-8" />
        
        <DeadlineOptimizer />
      </div>

      {/* Footer Info */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">AI-Powered Insights</h3>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Our AI assistant analyzes task complexity, considers industry best practices, 
            and provides intelligent recommendations to help you plan more effectively. 
            All suggestions are meant to guide your decision-making process.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}