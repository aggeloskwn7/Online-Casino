import React, { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { Redirect, useLocation } from 'wouter';
import MainLayout from '@/components/layouts/main-layout';
import {
  Card as UICard,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Search, UserCog, CoinsIcon, History, Ban, BadgeCheck, ShieldAlert, Info, Coins, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/game-utils';

// Component for the users tab
function UsersTab() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isBanDialogOpen, setIsBanDialogOpen] = useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  
  // Fetch users data
  const {
    data: usersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/admin/users', page],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/admin/users?page=${page}&limit=10`);
      return await res.json();
    }
  });
  
  // Search users
  const {
    data: searchResults,
    isLoading: isSearching,
    refetch: refetchSearch
  } = useQuery({
    queryKey: ['/api/admin/users/search', searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) return { users: [] };
      const res = await apiRequest('GET', `/api/admin/users/search?q=${encodeURIComponent(searchTerm)}`);
      return await res.json();
    },
    enabled: searchTerm.length >= 2
  });
  
  // Update admin status mutation
  const updateAdminStatus = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: number, isAdmin: boolean }) => {
      const res = await apiRequest('PATCH', `/api/admin/users/${userId}/admin-status`, { isAdmin });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User admin status updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/search'] });
      setIsAdminDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update admin status: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
  
  // Ban/unban user mutation
  const updateBanStatus = useMutation({
    mutationFn: async ({ userId, isBanned }: { userId: number, isBanned: boolean }) => {
      const res = await apiRequest('PATCH', `/api/admin/users/${userId}/ban`, { isBanned });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User ban status updated successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users/search'] });
      setIsBanDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to update ban status: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
  
  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.length >= 2) {
      refetchSearch();
    }
  };
  
  // Handle user details view
  const handleViewUserDetails = (user: any) => {
    setSelectedUser(user);
    setIsUserDialogOpen(true);
  };
  
  // Handle ban dialog
  const handleBanAction = (user: any) => {
    setSelectedUser(user);
    setIsBanDialogOpen(true);
  };
  
  // Handle admin status dialog
  const handleAdminAction = (user: any) => {
    setSelectedUser(user);
    setIsAdminDialogOpen(true);
  };
  
  // Pagination controls
  const handleNextPage = () => {
    if (usersData && page < usersData.pagination.totalPages) {
      setPage(page + 1);
    }
  };
  
  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };
  
  // Users to render (search results or paginated list)
  const usersToRender = searchTerm.length >= 2 && searchResults
    ? searchResults.users
    : usersData?.users || [];
  
  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500">Error loading users: {(error as Error).message}</p>
        <Button onClick={() => refetch()} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users by username..."
            className="flex-1"
          />
          <Button type="submit" disabled={isSearching || searchTerm.length < 2}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </form>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersToRender.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                usersToRender.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell>
                      {user.username}
                      {user.isOwner && (
                        <Badge className="ml-2 bg-purple-600">Owner</Badge>
                      )}
                      {user.isAdmin && !user.isOwner && (
                        <Badge className="ml-2 bg-blue-600">Admin</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(user.balance)}</TableCell>
                    <TableCell>
                      {user.isBanned ? (
                        <Badge variant="destructive">Banned</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewUserDetails(user)}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        
                        {!user.isOwner && (
                          <Button
                            variant={user.isBanned ? "outline" : "destructive"}
                            size="sm"
                            onClick={() => handleBanAction(user)}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        )}
                        
                        {/* Only owner can manage admin privileges */}
                        {!user.isOwner && currentUser?.isOwner && (
                          <Button
                            variant={user.isAdmin ? "default" : "outline"}
                            size="sm"
                            onClick={() => handleAdminAction(user)}
                          >
                            <ShieldAlert className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Only show pagination for regular listing, not search results */}
          {searchTerm.length < 2 && usersData && usersData.pagination && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-muted-foreground">
                Showing page {page} of {usersData.pagination.totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={page >= usersData.pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* User Details Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ID</Label>
                  <div className="font-mono">{selectedUser.id}</div>
                </div>
                <div>
                  <Label>Username</Label>
                  <div className="font-semibold">{selectedUser.username}</div>
                </div>
                <div>
                  <Label>Balance</Label>
                  <div className="text-green-600 font-semibold">
                    {formatCurrency(selectedUser.balance)}
                  </div>
                </div>
                <div>
                  <Label>Play Count</Label>
                  <div>{selectedUser.playCount || 0} games</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>
                    {selectedUser.isOwner && (
                      <Badge className="mr-2 bg-purple-600">Owner</Badge>
                    )}
                    {selectedUser.isAdmin && !selectedUser.isOwner && (
                      <Badge className="mr-2 bg-blue-600">Admin</Badge>
                    )}
                    {selectedUser.isBanned ? (
                      <Badge variant="destructive">Banned</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Last Login</Label>
                  <div>{selectedUser.lastLogin 
                    ? new Date(selectedUser.lastLogin).toLocaleString() 
                    : 'Never'}</div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Ban/Unban Dialog */}
      <Dialog open={isBanDialogOpen} onOpenChange={setIsBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.isBanned ? 'Unban User' : 'Ban User'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.isBanned
                ? 'Are you sure you want to unban this user? They will regain access to the platform.'
                : 'Are you sure you want to ban this user? They will lose access to the platform.'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label>Username</Label>
                <div className="font-semibold">{selectedUser.username}</div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsBanDialogOpen(false)}
                  disabled={updateBanStatus.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant={selectedUser.isBanned ? "default" : "destructive"}
                  onClick={() => updateBanStatus.mutate({
                    userId: selectedUser.id,
                    isBanned: !selectedUser.isBanned
                  })}
                  disabled={updateBanStatus.isPending}
                >
                  {updateBanStatus.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {selectedUser.isBanned ? 'Unban User' : 'Ban User'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Admin Status Dialog */}
      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.isAdmin ? 'Remove Admin' : 'Make Admin'}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.isAdmin
                ? 'Are you sure you want to remove admin privileges from this user?'
                : 'Are you sure you want to grant admin privileges to this user?'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <Label>Username</Label>
                <div className="font-semibold">{selectedUser.username}</div>
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsAdminDialogOpen(false)}
                  disabled={updateAdminStatus.isPending}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  onClick={() => updateAdminStatus.mutate({
                    userId: selectedUser.id,
                    isAdmin: !selectedUser.isAdmin
                  })}
                  disabled={updateAdminStatus.isPending}
                >
                  {updateAdminStatus.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {selectedUser.isAdmin ? 'Remove Admin' : 'Make Admin'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component for the coins tab
function CoinsTab() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [coinAmount, setCoinAmount] = useState<string>('100');
  const [reason, setReason] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  
  // Search user by username for coin adjustment
  const {
    data: searchResults,
    isLoading: isSearching,
    refetch: refetchSearch
  } = useQuery({
    queryKey: ['/api/admin/users/search', username],
    queryFn: async () => {
      if (!username || username.length < 2) return { users: [] };
      const res = await apiRequest('GET', `/api/admin/users/search?q=${encodeURIComponent(username)}`);
      return await res.json();
    },
    enabled: username.length >= 2
  });
  
  // Coin transactions history
  const {
    data: transactionsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['/api/admin/coin-transactions'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/admin/coin-transactions?limit=20`);
      return await res.json();
    }
  });
  
  // Adjust user balance mutation
  const adjustBalance = useMutation({
    mutationFn: async ({ 
      userId, 
      amount, 
      reason 
    }: { 
      userId: number, 
      amount: number, 
      reason: string 
    }) => {
      const res = await apiRequest('POST', `/api/admin/users/${userId}/adjust-balance`, {
        amount,
        reason
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'User balance adjusted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/coin-transactions'] });
      setIsAdjustDialogOpen(false);
      setCoinAmount('100');
      setReason('');
      setUsername('');
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: `Failed to adjust balance: ${error.message}`,
        variant: 'destructive',
      });
    }
  });
  
  // Handle search submission
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.length >= 2) {
      refetchSearch();
    }
  };
  
  // Select user for coin adjustment
  const handleSelectUser = (user: any) => {
    setSelectedUser(user);
  };
  
  // Open coin adjustment dialog
  const handleAdjustCoins = () => {
    if (selectedUser) {
      setIsAdjustDialogOpen(true);
    } else {
      toast({
        title: 'Error',
        description: 'Please select a user first',
        variant: 'destructive',
      });
    }
  };
  
  // Handle form submission for coin adjustment
  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) {
      toast({
        title: 'Error',
        description: 'Please select a user',
        variant: 'destructive',
      });
      return;
    }
    
    if (!coinAmount || isNaN(Number(coinAmount))) {
      toast({
        title: 'Error',
        description: 'Please enter a valid amount',
        variant: 'destructive',
      });
      return;
    }
    
    if (!reason.trim()) {
      toast({
        title: 'Error',
        description: 'Please provide a reason',
        variant: 'destructive',
      });
      return;
    }
    
    adjustBalance.mutate({
      userId: selectedUser.id,
      amount: Number(coinAmount),
      reason: reason.trim()
    });
  };
  
  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500">Error loading transactions: {(error as Error).message}</p>
        <Button onClick={() => refetch()} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }
  
  return (
    <div>
      <div className="mb-6">
        <UICard>
          <CardHeader>
            <CardTitle>Adjust User Balance</CardTitle>
            <CardDescription>
              Add or remove coins from a user's account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <form onSubmit={handleSearch} className="flex gap-2 mt-1">
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Search by username..."
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isSearching || username.length < 2}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </form>
                
                {username.length >= 2 && searchResults && searchResults.users && searchResults.users.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                    {searchResults.users.map((user: any) => (
                      <div
                        key={user.id}
                        className={`p-2 cursor-pointer hover:bg-muted flex justify-between items-center ${
                          selectedUser?.id === user.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => handleSelectUser(user)}
                      >
                        <div>
                          <span className="font-medium">{user.username}</span>
                          {user.isOwner && <Badge className="ml-2 bg-purple-600">Owner</Badge>}
                          {user.isAdmin && !user.isOwner && <Badge className="ml-2 bg-blue-600">Admin</Badge>}
                        </div>
                        <span className="text-green-600">{formatCurrency(user.balance)}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                {username.length >= 2 && searchResults && searchResults.users && searchResults.users.length === 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    No users found with that username
                  </div>
                )}
                
                {selectedUser && (
                  <div className="mt-4 p-3 border rounded-md bg-muted/50">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">Selected User:</span> {selectedUser.username}
                      </div>
                      <span className="text-green-600 font-semibold">{formatCurrency(selectedUser.balance)}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end">
                <Button
                  onClick={handleAdjustCoins}
                  disabled={!selectedUser}
                >
                  <Coins className="mr-2 h-4 w-4" />
                  Adjust Balance
                </Button>
              </div>
            </div>
          </CardContent>
        </UICard>
      </div>
      
      <div className="mt-8">
        <h3 className="text-lg font-medium mb-4">Recent Coin Transactions</h3>
        
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!transactionsData || !transactionsData.transactions || transactionsData.transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                transactionsData.transactions.map((transaction: any) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{transaction.id}</TableCell>
                    <TableCell>{transaction.userId}</TableCell>
                    <TableCell className={
                      transaction.amount > 0 
                        ? "text-green-600 font-medium" 
                        : "text-red-600 font-medium"
                    }>
                      {transaction.amount > 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell>{transaction.adminId}</TableCell>
                    <TableCell>{transaction.reason}</TableCell>
                    <TableCell>{new Date(transaction.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
      
      {/* Adjust Balance Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust User Balance</DialogTitle>
            <DialogDescription>
              Add or remove coins from {selectedUser?.username}'s account. Use positive numbers to add coins and negative numbers to remove coins.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitAdjustment} className="space-y-4">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <div className="relative mt-1">
                <Input
                  id="amount"
                  type="number"
                  value={coinAmount}
                  onChange={(e) => setCoinAmount(e.target.value)}
                  className="pl-8"
                  placeholder="Enter amount..."
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <span className="text-muted-foreground">$</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Use negative value (e.g. -100) to remove coins
              </p>
            </div>
            
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide a reason for this adjustment..."
                className="mt-1"
              />
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsAdjustDialogOpen(false)}
                disabled={adjustBalance.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={adjustBalance.isPending}
              >
                {adjustBalance.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Confirm Adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Main admin page component
export default function AdminPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  // Access check - redirect if not admin
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  if (!user.isAdmin) {
    return <Redirect to="/" />;
  }
  
  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
          <p className="text-muted-foreground">
            Manage users, adjust balances, and monitor system activity
          </p>
        </div>
        
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="users" className="flex items-center">
              <UserCog className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="coins" className="flex items-center">
              <CoinsIcon className="h-4 w-4 mr-2" />
              Coins
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center">
              <History className="h-4 w-4 mr-2" />
              Transactions
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          
          <TabsContent value="coins">
            <CoinsTab />
          </TabsContent>
          
          <TabsContent value="transactions">
            <div className="text-center p-12 text-muted-foreground">
              <h3 className="text-lg font-medium mb-2">Coming Soon</h3>
              <p>Transaction management features will be available soon.</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}