import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CreateProjectScreen from '../modules/projects/CreateProjectScreen';
import LandingScreen from '../modules/auth/LandingScreen';
import ProjectSettingsScreen from '../modules/projects/ProjectSettingsScreen';
import SignInScreen from '../modules/auth/SignInScreen';
import { MainTabs } from './MainTabs';
import { ProjectTabs } from './ProjectTabs';

export type RootStackParamList = {
  Landing: undefined;
  SignIn: undefined;
  Main: undefined;
  CreateProject: undefined;
  ProjectHome: { projectId: string; projectName: string };
  ProjectSettings: { projectId: string; projectName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type Props = {
  initialRouteName: 'Landing' | 'Main';
};

export function RootNavigator({ initialRouteName }: Props) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="CreateProject" component={CreateProjectScreen} />
      <Stack.Screen name="ProjectHome" component={ProjectTabs} />
      <Stack.Screen name="ProjectSettings" component={ProjectSettingsScreen} />
    </Stack.Navigator>
  );
}
