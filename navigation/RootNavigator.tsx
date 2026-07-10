import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CreateProjectScreen from '../screens/CreateProjectScreen';
import LandingScreen from '../screens/LandingScreen';
import ProjectHomeScreen from '../screens/ProjectHomeScreen';
import SignInScreen from '../screens/SignInScreen';
import { MainTabs } from './MainTabs';

export type RootStackParamList = {
  Landing: undefined;
  SignIn: undefined;
  Main: undefined;
  CreateProject: undefined;
  ProjectHome: { projectId: string; projectName: string };
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
      <Stack.Screen name="ProjectHome" component={ProjectHomeScreen} />
    </Stack.Navigator>
  );
}
