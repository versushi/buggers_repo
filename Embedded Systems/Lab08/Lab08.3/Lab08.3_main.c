#include <msp430.h> 
#include <stdint.h>
#define redLED BIT0 // Red LED at P1.0
#define BUT1 BIT1 // Button S1 at Port 1.1

#define FLAGS    UCA1IFG
#define RXFLAG   UCRXIFG
#define TXFLAG   UCTXIFG
#define RXBUFFER UCA1RXBUF
#define TXBUFFER UCA1TXBUF

void Initialize_ADC(void);

void Initialize_UART(void);
void uart_write_uint16(unsigned int n);
void uart_write_string(char *str_array);
void uart_write_char(unsigned char ch);
unsigned char uart_read_char(void);


volatile unsigned int moveCursor = 0;
volatile unsigned int adjustValue = 1;
volatile unsigned int updateModeDisplay = 0;

int main(void)
{
	WDTCTL = WDTPW | WDTHOLD;	// stop watchdog timer
	PM5CTL0 &= ~LOCKLPM5;
	P1DIR |= redLED; 		// Direct pin as output
	P1OUT &= ~redLED; 		// Turn LED Off

	// Initialize button with interupts
	P1DIR &= ~BUT1; // 0: input
	P1REN |= BUT1;  // 1: enable built-in resistors
	P1OUT |= BUT1;  // 1: built-in resistor is pulled up to Vcc
	P1IES |= BUT1;  // 1: interrupt on falling edge (0 for rising edge)
	P1IFG &= ~BUT1; // 0: clear the interrupt flags
	P1IE  |= BUT1;  // 1: enable the interrupts

	unsigned int x_value, y_value;
	unsigned int x_right_limit = 1760;
	unsigned int x_left_limit = 2160;
	unsigned int y_up_limit = 1760;
	unsigned int y_down_limit = 2160;
	unsigned int topRight = 127;
	unsigned int topLeft = 127;
	unsigned int bottomRight = 127;
	unsigned int bottomLeft = 127;
	unsigned int cursorRow = 6;
	unsigned int cursorCol = 9;
	unsigned int diagonal1, diagonal2;
	unsigned int maxDelta;
	unsigned int previousDelta = 0;
	unsigned int dangerDisplayed = 0; 

	Initialize_ADC();
    Initialize_UART();

	// Buzzer: P2.7, Timer_B0 channel 6
	P2DIR |= BIT7;
	P2SEL1 &= ~BIT7;
	P2SEL0 |= BIT7;

	// 1 kHz, 50% duty cycle, since SMCLK = 1 MHz
	TB0CCR0 = 999;
	TB0CCR6 = 500;
	TB0CCTL6 = 0;  // Initially silent
	TB0CTL = TBSSEL_2 | MC_1 | TBCLR;

	// Clear screen, start at row 1
	uart_write_string("\033[2J\033[H");

	uart_write_string("*** PLATFORM BALANCING CONTROL ***\r\n\n\n");
	uart_write_string("                TOP\r\n");
	uart_write_string("       ....................\r\n");
	uart_write_string("       | 127          127 |\r\n");
	uart_write_string("     L |                  | R\r\n");
	uart_write_string("     E |                  | I\r\n");
	uart_write_string("     F |     BALANCED     | G\r\n");
	uart_write_string("     T |                  | H\r\n");
	uart_write_string("       |                  | T\r\n");
	uart_write_string("       | 127          127 |\r\n");
	uart_write_string("       ....................\r\n");
	uart_write_string("              BOTTOM\r\n\n\n\n");
	uart_write_string("  MOVE CURSOR	  MAX DELTA\r\n");
	uart_write_string("* ADJUST VALUE		 0 mm\r\n");
	uart_write_string("\033[6;9H");

	__enable_interrupt();
	for(;;){
		if (updateModeDisplay) {
			updateModeDisplay = 0;

			// Save cursor position
			uart_write_string("\033[s");

			// Clear both mode markers
			uart_write_string("\033[18;1H ");
			uart_write_string("\033[19;1H ");

			if (moveCursor == 1) {
				uart_write_string("\033[18;1H*");
			} else {
				uart_write_string("\033[19;1H*");
			}

			// Restore cursor position
			uart_write_string("\033[u");
		}
		// Start the conversion
		ADC12CTL0 |= ADC12SC;

		// Wait until the final result (Y) is ready 
		while ((ADC12IFGR0 & ADC12IFG1) == 0) {}
		
		// Read results (reading MEM clears its corresponding flag)
		x_value = ADC12MEM0;
		y_value = ADC12MEM1;

		if (adjustValue == 1){
			if (cursorRow == 12 && cursorCol == 9){
				if (y_value < y_up_limit && bottomLeft < 255) {
					bottomLeft++;
				} else if (y_value > y_down_limit && bottomLeft > 0) {
					bottomLeft--;
				}
				uart_write_string("\033[12;10H   \033[12;10H");
				uart_write_uint16(bottomLeft);
				uart_write_string("\033[12;9H");
			}else if (cursorRow == 12 && cursorCol == 22){
				if (y_value < y_up_limit && bottomRight < 255) {
					bottomRight++;
				} else if (y_value > y_down_limit && bottomRight > 0) {
					bottomRight--;
				}
				uart_write_string("\033[12;23H   \033[12;23H");
				uart_write_uint16(bottomRight);
				uart_write_string("\033[12;22H");
			}else if (cursorRow == 6 && cursorCol == 9){
				if (y_value < y_up_limit && topLeft < 255) {
					topLeft++;
				} else if (y_value > y_down_limit && topLeft > 0) {
					topLeft--;
				}
				uart_write_string("\033[6;10H");
				uart_write_uint16(topLeft);
				uart_write_string("   ");
				uart_write_string("\033[6;9H");
			}else if (cursorRow == 6 && cursorCol == 22){
				if (y_value < y_up_limit && topRight < 255) {
					topRight++;
				} else if (y_value > y_down_limit && topRight > 0) {
					topRight--;
				}
				uart_write_string("\033[6;23H   \033[6;23H");
				uart_write_uint16(topRight);
				uart_write_string("\033[6;22H");
			}

		}
		if(moveCursor == 1){
			// Move to bottom left
			if((x_value > x_left_limit) && (y_value > y_down_limit)){
			uart_write_string("\033[12;9H");
			cursorRow = 12;
			cursorCol = 9;
			}
			// Move to bottom right
			else if((x_value < x_right_limit) && (y_value > y_down_limit)){
			uart_write_string("\033[12;22H");
			cursorRow = 12;
			cursorCol = 22;
			}
			// Move to top left
			else if((x_value > x_left_limit) && (y_value < y_up_limit)){
			uart_write_string("\033[6;9H");
			cursorRow = 6;
			cursorCol = 9;
			}
			// Move to top right
			else if((x_value < x_right_limit) && (y_value < y_up_limit)){
			uart_write_string("\033[6;22H");
			cursorRow = 6;
			cursorCol = 22;
			}
		}

		// Difference between top-left and bottom-right
		if (topLeft >= bottomRight) {
			diagonal1 = topLeft - bottomRight;
		} else {
			diagonal1 = bottomRight - topLeft;
		}

		// Difference between top-right and bottom-left
		if (topRight >= bottomLeft) {
			diagonal2 = topRight - bottomLeft;
		} else {
			diagonal2 = bottomLeft - topRight;
		}

		// Select the larger difference
		if (diagonal1 >= diagonal2) {
			maxDelta = diagonal1;
		} else {
			maxDelta = diagonal2;
		}
		// Only redraw delta when its value changes
    	if (maxDelta != previousDelta) {
			uart_write_string("\033[s");

			uart_write_string("\033[19;23H");
			uart_write_uint16(maxDelta);
			uart_write_string(" mm     ");

			uart_write_string("\033[u");
			previousDelta = maxDelta;
    	}

		// Below lines change the delta, Danger sign, and tone
		// Save cursor position
		uart_write_string("\033[s");

		// Status text starts at row 9, column 14
		uart_write_string("\033[9;14H");

		if (maxDelta >= 11) {
			TB0CCTL6 = OUTMOD_7;

			if (dangerDisplayed == 0) {
				uart_write_string("\033[s");
				uart_write_string("\033[9;14H*DANGER*");
				uart_write_string("\033[u");

				dangerDisplayed = 1;
			}
		} else {
			TB0CCTL6 = 0;
			if (dangerDisplayed == 1) {
                uart_write_string("\033[s");
                uart_write_string("\033[9;14HBALANCED");
                uart_write_string("\033[u");

                dangerDisplayed = 0;
			}
		}

		// Return to the selected cursor position
		uart_write_string("\033[u");

		P1OUT ^= redLED;		// Toggle LED
		__delay_cycles(500000); // About 0.5 second at 1 MHz
	}
	return 0;
}

#pragma vector=PORT1_VECTOR
__interrupt void Port_1_ISR(void)
{
    if (P1IFG & BIT1) {
        // Basic debounce: about 20 ms at 1 MHz
        __delay_cycles(20000);

        if ((P1IN & BIT1) == 0) {
            moveCursor ^= 1;
            adjustValue = !moveCursor;
            updateModeDisplay = 1;
        }

        P1IFG &= ~BIT1;
    }
}

void Initialize_ADC() {
	// Configure the pins to analog functionality
	// X-axis: A10/P9.2, for A10 (P9DIR=x, P9SEL1=1, P9SEL0=1)
	P9SEL1 |= BIT2;
	P9SEL0 |= BIT2;
	// Y-axis: A4/P8.7, for A4 (P8DIR=x, P8SEL1=1, P8SEL0=1)
	P8SEL1 |= BIT7;
	P8SEL0 |= BIT7;
	
	// Turn on the ADC module
	ADC12CTL0 |= ADC12ON;
	// Turn off ENC (Enable Conversion) bit while modifying the configuration
	ADC12CTL0 &= ~ADC12ENC;
	//*************** ADC12CTL0 ***************
	// Set ADC12SHT0 (select the number of cycles that you computed)
	// t(sht) ≥ (4k + 10k)*(15pF+1pF)*ln(2^(12+1))
	// t(sht) ≥ 2 useconds 
	// N = t(sht)f(abc) = 2 useconds * 5.4MHz
	// N = 10.9 cycles --> round UP to 16 cycles
	// 8/5.4 MHz = 1.48 us: sampling time too short
	// 16/5.4 MHz = 2.96 us: exceeds the required 2.02 us
	// Select option 2 which is 16 cycles
	ADC12CTL0 |= ADC12SHT0_2;
	// Set the bit ADC12MSC (Multiple Sample and Conversion)
	ADC12CTL0 |= ADC12MSC;
	//*************** ADC12CTL1 ***************
	// Set ADC12SHS (select ADC12SC bit as the trigger)
	ADC12CTL1 |= ADC12SHS_0;
	// Set ADC12SHP bit
	ADC12CTL1 |= ADC12SHP;
	// Set ADC12DIV (select the divider you determined)
	ADC12CTL1 |= ADC12DIV_0;
	// Set ADC12SSEL (select MODOSC)
	ADC12CTL1 |= ADC12SSEL_0;
	// Set ADC12CONSEQ (select sequence-of-channels)
	ADC12CTL1 |= ADC12CONSEQ_1;

	//*************** ADC12CTL2 ***************
	// Set ADC12RES (select 12-bit resolution)
	ADC12CTL2 |= ADC12RES_2;
	// Set ADC12DF (select unsigned binary format)
	ADC12CTL2 &= ~ADC12DF;

	//*************** ADC12CTL3 ***************
	// Leave all fields at default values
	
	//*************** ADC12MCTL0 ***************
	// X Axis
	// Set ADC12VRSEL (select VR+=AVCC, VR-=AVSS)
	ADC12MCTL0 |= ADC12VRSEL_0;

	// Set ADC12INCH (select channel A10)
	ADC12MCTL0 |= ADC12INCH_10;
	
	//*************** ADC12MCTL1 ***************
	// Y Axis
	// Set ADC12INCH (select the analog channel that you found)
	ADC12MCTL1 |= ADC12INCH_4;
	// Set ADC12EOS (last conversion in ADC12MEM1)
	ADC12MCTL1 |= ADC12EOS;

	// Turn on ENC (Enable Conversion) bit at the end of the configuration
	ADC12CTL0 |= ADC12ENC;
	return;
}

void Initialize_UART(void){
	// Configure pins to UART functionality
	P3SEL1 &= ~(BIT4|BIT5);
	P3SEL0 |= (BIT4|BIT5);
	// Main configuration register
	UCA1CTLW0 = UCSWRST; // Engage reset; change all the fields to zero
	// Most fields in this register, when set to zero, correspond to the
	// popular configuration
	UCA1CTLW0 |= UCSSEL_2; // Set clock to SMCLK
	// Configure the clock dividers and modulators (and enable oversampling)
	UCA1BRW = 6; // divider
	// Modulators: UCBRF = 8 = 1000 --> UCBRF3 (bit #3)
	// UCBRS = 0x20 = 0010 0000 = UCBRS5 (bit #5)
	UCA1MCTLW = UCBRF3 | UCBRS5 | UCOS16;
	// Exit the reset state
	UCA1CTLW0 &= ~UCSWRST;
}

void uart_write_uint16 (unsigned int n){
	unsigned int m = 0;
	char digits[5];
	// This checks if the number is 0
	if (n == 0) {
		uart_write_char('0');
		return;
	}
	
	while (n > 0) {
		// Cuts far right digit and puts into array
        digits[m] = '0' + (n % 10);
		// Goes to the next spot in array
        m++;
		// Makes n smaller ie from 4567 --> 456
        n /= 10;
    }
	// This loop prints the array backwards since it was uploaded into the array backwards
    while (m > 0) {
        m--;
        uart_write_char(digits[m]);
    }
}

void uart_write_string (char * str_array){
	unsigned int i;
	for(i = 0;str_array[i] != '\0';i++){
		uart_write_char(str_array[i]);
	}
}

unsigned char uart_read_char(void){
	unsigned char temp;
	// Return null character (ASCII=0) if no byte was received
	if( (FLAGS & RXFLAG) == 0)
	return 0;
	// Otherwise, copy the received byte (this clears the flag) and return it
	temp = RXBUFFER;
	return temp;
}

void uart_write_char(unsigned char ch){
	// Wait for any ongoing transmission to complete
	while ( (FLAGS & TXFLAG) == 0 ) {}
	// Copy the byte to the transmit buffer
	TXBUFFER = ch; // Tx flag goes to 0 and Tx begins!
	return;
}