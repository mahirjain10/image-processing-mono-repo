import {
  IsEmail,
  isEmail,
  IsNotEmpty,
  IsString,
  isString,
  MaxLength,
  MinLength,
} from 'class-validator';

class CreateUserDto {
  @IsNotEmpty({ message: "Name field can't be empty" })
  @IsString({ message: 'Name field should be a string' })
  name: string;

  @IsNotEmpty({ message: "Email field can't be empty" })
  @IsString({ message: 'Email field should be a string' })
  @IsEmail({}, { message: 'Enter a correct email' })
  email: string;

  @IsNotEmpty({ message: 'Password field cannot be empty ' })
  @IsString({ message: 'Password should be a string' })
  @MaxLength(16, {
    message: 'Max length cannot be greater than 16 charachters',
  })
  @MinLength(8, {
    message: 'Min length cannot be less than 8 charachters',
  })
  password: string;
}

export default CreateUserDto;
