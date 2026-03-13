
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useApi } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { useEffect } from "react";

const customerSchema = z.object({
  name: z.string().min(3, "Customer name must be at least 3 characters."),
  phone: z.string().min(10, "Please enter a valid phone number."),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

type CustomerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  onCustomerUpdate: () => void;
};

export function CustomerDialog({ open, onOpenChange, customer, onCustomerUpdate }: CustomerDialogProps) {
  const { toast } = useToast();
  const { createCustomer, updateCustomer } = useApi();
  const isEditMode = !!customer;

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (isEditMode && customer) {
        form.reset({
          name: customer.name,
          phone: customer.phone,
        });
      } else {
        form.reset({
          name: "",
          phone: "",
        });
      }
    }
  }, [customer, isEditMode, open, form]);
  

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      if (isEditMode && customer) {
        await updateCustomer(customer.id, data);
        toast({
          title: "Success",
          description: "Customer updated successfully.",
        });
      } else {
        await createCustomer(data);
        toast({
          title: "Success",
          description: "Customer created successfully.",
        });
      }
      onOpenChange(false);
      onCustomerUpdate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to ${isEditMode ? 'update' : 'create'} customer: ${message}`,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          <DialogDescription>
            {isEditMode ? "Update the details for this customer." : "Enter the details for the new customer."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Stark Industries" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 555-123-4567" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : (isEditMode ? "Save Changes" : "Save Customer")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
