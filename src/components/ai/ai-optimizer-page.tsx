
"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { suggestDeadlineAction, type SuggestDeadlineActionState, parseTaskFromTextAction, type ParseTaskFromTextActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, CheckCircle, AlertCircle, Lightbulb, Wand2, Sparkles } from "lucide-react";
import { format, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

function SuggestDeadlineSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? "Optimizing Deadline..." : "Get Deadline Suggestion"}
    </Button>
  );
}

function ParseTaskSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
       <Sparkles className="mr-2 h-4 w-4" /> {pending ? "Parsing Task..." : "Parse Task from Text"}
    </Button>
  );
}


export function NaturalLanguageTaskCreator() {
  const initialParseState: ParseTaskFromTextActionState = { success: false };
  const [parseState, parseFormAction] = useActionState(parseTaskFromTextAction, initialParseState);
  const parseFormRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (parseState.message && !parseState.success) {
      toast({
        title: "Parsing Error",
        description: parseState.message,
        variant: "destructive",
      });
    }
  }, [parseState, toast]);

  return (
     <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Wand2 className="mr-2 h-6 w-6 text-primary" />
            Create Task with Natural Language
          </CardTitle>
          <CardDescription>
            Type a task description in plain English (e.g., "Fix login bug by next Wednesday high priority"). The AI will attempt to parse it into structured task details.
          </CardDescription>
        </CardHeader>
        <form action={parseFormAction} ref={parseFormRef}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="naturalLanguageInput" className="text-sm font-medium">Your Task Idea</Label>
              <Textarea
                id="naturalLanguageInput"
                name="naturalLanguageInput"
                placeholder="e.g., 'Schedule a team meeting for next Monday at 2 PM to discuss Q3 roadmap.'"
                rows={4}
                className="mt-1"
                required
                aria-describedby="naturalLanguageInputError"
              />
              {parseState.errors?.naturalLanguageInput && (
                <p id="naturalLanguageInputError" className="text-sm text-destructive mt-1">
                  {parseState.errors.naturalLanguageInput.join(", ")}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-end items-center pt-4">
             <ParseTaskSubmitButton />
          </CardFooter>
        </form>

        {parseState.errors?._form && (
          <Alert variant="destructive" className="mt-4 mx-6 mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{parseState.errors._form.join(", ")}</AlertDescription>
          </Alert>
        )}

        {parseState.success && parseState.data && (
          <div className="mt-6 mx-6 mb-6 p-4 border rounded-md bg-muted/30">
            <Alert variant="default" className="border-blue-500 bg-blue-50 dark:bg-blue-900/30">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="font-semibold text-blue-700 dark:text-blue-300">AI Parsed Task Details:</AlertTitle>
              <AlertDescription className="text-blue-600 dark:text-blue-400">
                <div className="mt-3 space-y-2 text-sm">
                  {parseState.data.title && <p><strong>Title:</strong> {parseState.data.title}</p>}
                  {parseState.data.description && <p><strong>Description:</strong> {parseState.data.description}</p>}
                  {parseState.data.deadline && (
                    <p>
                      <strong>Suggested Deadline:</strong>{' '}
                      {format(parseISO(parseState.data.deadline), "PPPppp ' ('EEEE')'")}
                    </p>
                  )}
                  {parseState.data.priority && <p><strong>Suggested Priority:</strong> {parseState.data.priority}</p>}
                  {parseState.data.reasoning && <p className="mt-2 text-xs italic"><strong>AI Reasoning:</strong> {parseState.data.reasoning}</p>}
                  <p className="mt-3 text-xs text-muted-foreground">You can use these details to manually create a task in the Admin panel.</p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </Card>
  );
}


export function AiOptimizerPage() {
  const initialSuggestState: SuggestDeadlineActionState = { success: false };
  const [suggestState, suggestFormAction] = useActionState(suggestDeadlineAction, initialSuggestState);
  const { toast } = useToast();
  const suggestFormRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (suggestState.message) {
      if (suggestState.success) {
        toast({
          title: "Success",
          description: suggestState.message,
          variant: "default",
        });
        // suggestFormRef.current?.reset(); // Removed reset for suggest deadline
      } else {
         toast({
          title: "Error",
          description: suggestState.message,
          variant: "destructive",
        });
      }
    }
  }, [suggestState, toast]);


  return (
    <div className="p-4 md:p-6 space-y-8">
      <h1 className="text-3xl font-bold font-headline text-foreground">AI Powered Assistance</h1>
      
      <NaturalLanguageTaskCreator />

      <Separator className="my-8" />

      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lightbulb className="mr-2 h-6 w-6 text-primary" />
            Optimize Task Deadline
          </CardTitle>
          <CardDescription>
            Describe your task, and our AI will suggest an optimal deadline and provide reasoning.
          </CardDescription>
        </CardHeader>
        <form action={suggestFormAction} ref={suggestFormRef}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="taskDescription" className="text-sm font-medium">Task Description for Deadline Optimization</Label>
              <Textarea
                id="taskDescription"
                name="taskDescription"
                placeholder="e.g., 'Develop a new feature for user authentication including two-factor authentication and social logins...'"
                rows={5}
                className="mt-1"
                required
                aria-describedby="taskDescriptionError"
              />
              {suggestState.errors?.taskDescription && (
                <p id="taskDescriptionError" className="text-sm text-destructive mt-1">
                  {suggestState.errors.taskDescription.join(", ")}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-end items-center pt-4">
             <SuggestDeadlineSubmitButton />
          </CardFooter>
        </form>

        {suggestState.errors?._form && (
          <Alert variant="destructive" className="mt-4 mx-6 mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{suggestState.errors._form.join(", ")}</AlertDescription>
          </Alert>
        )}

        {suggestState.success && suggestState.data && (
          <div className="mt-6 mx-6 mb-6 p-4 border rounded-md bg-muted/30">
            <Alert variant="default" className="border-green-500 bg-green-50 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <AlertTitle className="font-semibold text-green-700 dark:text-green-300">AI Deadline Suggestion Received!</AlertTitle>
              <AlertDescription className="text-green-600 dark:text-green-400">
                <div className="mt-3 space-y-3">
                  <p>
                    <strong>Suggested Deadline:</strong>{' '}
                    {suggestState.data.suggestedDeadline ? 
                      format(parseISO(suggestState.data.suggestedDeadline), "PPPppp ' ('EEEE')'") : 
                      "Not available"}
                  </p>
                  <p>
                    <strong>Reasoning:</strong> {suggestState.data.reasoning}
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </Card>
    </div>
  );
}
